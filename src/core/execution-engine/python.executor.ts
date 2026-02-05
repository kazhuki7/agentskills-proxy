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

export class PythonExecutor extends BaseExecutor {
  private processes: Map<string, ChildProcess> = new Map();

  async *execute(
    request: ExecutionRequest & { skillBaseDir: string; executionId: string }
  ): AsyncGenerator<ExecutionOutput> {
    const { executionId, skillBaseDir, scriptPath, parameters, options } = request;
    const startTime = Date.now();
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

      const fullScriptPath = path.join(skillBaseDir, scriptPath);

      // Build environment variables
      const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        ...options.envVars,
        SKILL_PARAMS: JSON.stringify(parameters),
        SKILL_ARTIFACT_DIR: artifactDir,
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONUNBUFFERED: '1',
      };

      // Spawn Python process
      const pythonProcess = spawn('python3', ['-u', fullScriptPath], {
        env,
        cwd: skillBaseDir,
        timeout: (options.timeoutSeconds || config.maxExecutionTime) * 1000,
      });

      this.processes.set(executionId, pythonProcess);

      // Handle abort
      abortController.signal.addEventListener('abort', () => {
        pythonProcess.kill('SIGTERM');
      });

      // Stream stdout
      for await (const chunk of pythonProcess.stdout) {
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
      for await (const chunk of pythonProcess.stderr) {
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
        pythonProcess.on('exit', (code) => {
          resolve(code || 0);
        });
        pythonProcess.on('error', (err) => {
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
      logger.error(`Python execution error [${executionId}]:`, error);

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
      '.html': 'text/html',
      '.py': 'text/x-python',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.pdf': 'application/pdf',
      '.csv': 'text/csv',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

export default PythonExecutor;
