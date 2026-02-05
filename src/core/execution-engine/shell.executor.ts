import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
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

export class ShellExecutor extends BaseExecutor {
  private processes: Map<string, ChildProcess> = new Map();
  
  private static readonly ALLOWED_COMMANDS = new Set([
    'echo', 'cat', 'grep', 'awk', 'sed', 'sort', 'uniq', 'wc', 'head', 'tail',
    'cut', 'tr', 'tee', 'xargs', 'find', 'ls', 'pwd', 'date', 'basename', 'dirname',
    'mkdir', 'touch', 'cp', 'mv', 'test', 'expr', 'seq', 'printf', 'read',
  ]);

  private static readonly BLOCKED_PATTERNS = [
    /rm\s+(-rf?|--force)/i,
    /rm\s+-r/i,
    /dd\s+/i,
    /mkfs/i,
    /shutdown/i,
    /reboot/i,
    /:\(\)\{/,  // fork bomb
    />\s*\/dev\//i,
    /curl.*\|.*sh/i,
    /wget.*\|.*sh/i,
    /eval\s+/i,
    /`.*`/,  // command substitution (backticks)
    /\$\(.*\)/,  // command substitution
  ];

  async *execute(
    request: ExecutionRequest & { skillBaseDir: string; executionId: string }
  ): AsyncGenerator<ExecutionOutput> {
    const { executionId, skillBaseDir, scriptPath, parameters, options } = request;
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    // Check if shell execution is enabled
    if (!config.enableShellExecution) {
      yield {
        type: 'ERROR',
        executionId,
        status: ExecutionStatus.FAILED,
        error: 'Shell execution is disabled',
      };
      return;
    }

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

      const fullScriptPath = path.join(skillBaseDir, scriptPath);
      
      // Read and validate script
      const scriptContent = await fs.readFile(fullScriptPath, 'utf-8');
      const validationError = this.validateScript(scriptContent);
      if (validationError) {
        yield {
          type: 'ERROR',
          executionId,
          status: ExecutionStatus.FAILED,
          error: validationError,
        };
        return;
      }

      // Build environment variables
      const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        ...options.envVars,
        SKILL_ARTIFACT_DIR: artifactDir,
      };

      // Add parameters as environment variables
      for (const [key, value] of Object.entries(parameters)) {
        env[`PARAM_${key.toUpperCase()}`] = value;
      }

      // Spawn shell process
      const shellProcess = spawn('bash', [fullScriptPath], {
        env,
        cwd: skillBaseDir,
        timeout: (options.timeoutSeconds || config.maxExecutionTime) * 1000,
      });

      this.processes.set(executionId, shellProcess);

      // Handle abort
      abortController.signal.addEventListener('abort', () => {
        shellProcess.kill('SIGTERM');
      });

      // Stream stdout
      for await (const chunk of shellProcess.stdout) {
        const content = chunk.toString();
        stdout += content;
        
        if (options.captureStdout) {
          yield {
            type: 'STREAM',
            executionId,
            stream: {
              type: 'STDOUT',
              content,
              timestamp: Date.now(),
            },
          };
        }
      }

      // Stream stderr
      for await (const chunk of shellProcess.stderr) {
        const content = chunk.toString();
        stderr += content;
        
        if (options.captureStderr) {
          yield {
            type: 'STREAM',
            executionId,
            stream: {
              type: 'STDERR',
              content,
              timestamp: Date.now(),
            },
          };
        }
      }

      // Wait for exit
      const exitCode = await new Promise<number>((resolve, reject) => {
        shellProcess.on('exit', (code) => {
          resolve(code || 0);
        });
        shellProcess.on('error', (err) => {
          reject(err);
        });
      });

      // Collect artifacts
      const artifacts = await this.collectArtifacts(artifactDir, executionId);

      const status = exitCode === 0 ? ExecutionStatus.COMPLETED : ExecutionStatus.FAILED;
      this.setStatus(executionId, status);

      yield {
        type: 'RESULT',
        executionId,
        status,
        result: {
          exitCode,
          stdout,
          stderr,
          artifacts,
          executionTimeMs: Date.now() - startTime,
          metadata: {},
        },
      };
    } catch (error: any) {
      const isTimeout = error.message?.includes('ETIMEDOUT') || error.killed;
      const status = isTimeout ? ExecutionStatus.TIMEOUT : ExecutionStatus.FAILED;
      
      this.setStatus(executionId, status);
      logger.error(`Shell execution error [${executionId}]:`, error);

      yield {
        type: 'ERROR',
        executionId,
        status,
        error: error.message || 'Unknown error',
      };
    } finally {
      this.processes.delete(executionId);
      this.clearExecution(executionId);
    }
  }

  async cancel(executionId: string): Promise<boolean> {
    const process = this.processes.get(executionId);
    if (process) {
      process.kill('SIGTERM');
      this.processes.delete(executionId);
    }
    return super.cancel(executionId);
  }

  private validateScript(content: string): string | null {
    for (const pattern of ShellExecutor.BLOCKED_PATTERNS) {
      if (pattern.test(content)) {
        return `Script contains blocked pattern: ${pattern.source}`;
      }
    }
    return null;
  }

  private async collectArtifacts(artifactDir: string, executionId: string): Promise<Artifact[]> {
    const artifacts: Artifact[] = [];
    
    try {
      const files = await fs.readdir(artifactDir);
      
      for (const file of files) {
        const filePath = path.join(artifactDir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isFile()) {
          artifacts.push({
            id: uuidv4(),
            filename: file,
            mimeType: this.getMimeType(file),
            size: stat.size,
            downloadUrl: `/download/artifacts/${executionId}/${file}`,
            checksum: '',
            fullPath: filePath,
          });
        }
      }
    } catch (error) {
      logger.warn(`Error collecting artifacts from ${artifactDir}:`, error);
    }
    
    return artifacts;
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.sh': 'text/x-shellscript',
      '.log': 'text/plain',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

export default ShellExecutor;
