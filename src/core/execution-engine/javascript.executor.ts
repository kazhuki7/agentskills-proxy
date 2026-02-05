import * as fs from 'fs/promises';
import * as path from 'path';
import { VM, VMScript } from 'vm2';
import { v4 as uuidv4 } from 'uuid';
import {
  ExecutionRequest,
  ExecutionOutput,
  ExecutionStatus,
  Artifact,
} from '../../models/skill.model';
import { BaseExecutor } from './executor.interface';
import { config } from '../../config';
import logger from '../../utils/logger';

export class JavaScriptExecutor extends BaseExecutor {
  async *execute(
    request: ExecutionRequest & { skillBaseDir: string; executionId: string }
  ): AsyncGenerator<ExecutionOutput> {
    const { executionId, skillBaseDir, scriptPath, parameters, options } = request;
    const startTime = Date.now();
    const artifacts: Artifact[] = [];
    let stdout = '';
    let stderr = '';

    const abortController = new AbortController();
    this.setStatus(executionId, ExecutionStatus.RUNNING, abortController);

    try {
      yield {
        type: 'STATUS',
        executionId,
        status: ExecutionStatus.RUNNING,
      };

      // Create artifact directory
      const artifactDir = path.join(config.artifactsDir, executionId);
      await fs.mkdir(artifactDir, { recursive: true });

      // Read script content
      const fullScriptPath = path.join(skillBaseDir, scriptPath);
      const scriptContent = await fs.readFile(fullScriptPath, 'utf-8');

      // Build sandbox
      const sandbox = this.buildSandbox(
        parameters,
        artifactDir,
        artifacts,
        (content: string) => {
          stdout += content + '\n';
        },
        (content: string) => {
          stderr += content + '\n';
        }
      );

      // Create VM
      const vm = new VM({
        timeout: (options.timeoutSeconds || config.maxExecutionTime) * 1000,
        sandbox,
        eval: false,
        wasm: false,
      });

      // Execute script
      const script = new VMScript(scriptContent, fullScriptPath);
      const result = await vm.run(script);

      // Yield stdout if captured
      if (stdout && options.captureStdout) {
        yield {
          type: 'STREAM',
          executionId,
          stream: {
            type: 'STDOUT',
            content: stdout,
            timestamp: Date.now(),
          },
        };
      }

      // Yield stderr if captured
      if (stderr && options.captureStderr) {
        yield {
          type: 'STREAM',
          executionId,
          stream: {
            type: 'STDERR',
            content: stderr,
            timestamp: Date.now(),
          },
        };
      }

      this.setStatus(executionId, ExecutionStatus.COMPLETED);

      yield {
        type: 'RESULT',
        executionId,
        status: ExecutionStatus.COMPLETED,
        result: {
          exitCode: 0,
          stdout,
          stderr,
          artifacts,
          executionTimeMs: Date.now() - startTime,
          metadata: {
            result: typeof result === 'object' ? JSON.stringify(result) : String(result),
          },
        },
      };
    } catch (error: any) {
      const isTimeout = error.message?.includes('Script execution timed out');
      const status = isTimeout ? ExecutionStatus.TIMEOUT : ExecutionStatus.FAILED;
      
      this.setStatus(executionId, status);
      logger.error(`JavaScript execution error [${executionId}]:`, error);

      yield {
        type: 'ERROR',
        executionId,
        status,
        error: error.message || 'Unknown error',
      };
    } finally {
      this.clearExecution(executionId);
    }
  }

  private buildSandbox(
    parameters: Record<string, string>,
    artifactDir: string,
    artifacts: Artifact[],
    onStdout: (content: string) => void,
    onStderr: (content: string) => void
  ): Record<string, any> {
    return {
      console: {
        log: (...args: any[]) => {
          const content = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
          onStdout(content);
        },
        error: (...args: any[]) => {
          const content = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
          onStderr(content);
        },
        warn: (...args: any[]) => {
          const content = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
          onStderr('[WARN] ' + content);
        },
        info: (...args: any[]) => {
          const content = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
          onStdout('[INFO] ' + content);
        },
      },
      SKILL_PARAMS: parameters,
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Promise,
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, Math.min(ms, 30000)),
      clearTimeout,
      writeArtifact: async (filename: string, content: string | Buffer): Promise<Artifact> => {
        const artifactId = uuidv4();
        const artifactPath = path.join(artifactDir, filename);
        const buffer = typeof content === 'string' ? Buffer.from(content) : content;
        
        await fs.writeFile(artifactPath, buffer);
        
        const artifact: Artifact = {
          id: artifactId,
          filename,
          mimeType: this.getMimeType(filename),
          size: buffer.length,
          downloadUrl: `/download/artifacts/${path.basename(artifactDir)}/${filename}`,
          checksum: '',
          fullPath: artifactPath,
        };
        
        artifacts.push(artifact);
        return artifact;
      },
    };
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.xml': 'application/xml',
      '.csv': 'text/csv',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

export default JavaScriptExecutor;
