import * as grpc from '@grpc/grpc-js';
import { v4 as uuidv4 } from 'uuid';
import { SkillRegistry } from '../../core/skill-manager/registry';
import { JavaScriptExecutor } from '../../core/execution-engine/javascript.executor';
import { PythonExecutor } from '../../core/execution-engine/python.executor';
import { ShellExecutor } from '../../core/execution-engine/shell.executor';
import { IExecutor } from '../../core/execution-engine/executor.interface';
import {
  ScriptType,
  ExecutionStatus,
  ExecutionOptions,
  ExecutionResult,
  Artifact,
} from '../../models/skill.model';
import { config } from '../../config';
import logger from '../../utils/logger';

const executors: Record<string, IExecutor> = {
  javascript: new JavaScriptExecutor(),
  python: new PythonExecutor(),
  shell: new ShellExecutor(),
};

const executionResults: Map<string, ExecutionResult> = new Map();

function parseScriptType(type: string): ScriptType {
  switch (type) {
    case 'PYTHON':
    case '1':
      return ScriptType.PYTHON;
    case 'SHELL':
    case '2':
      return ScriptType.SHELL;
    case 'JAVASCRIPT':
    case '0':
    default:
      return ScriptType.JAVASCRIPT;
  }
}

function parseExecutionOptions(options: any): ExecutionOptions {
  return {
    timeoutSeconds: parseInt(options?.timeout_seconds, 10) || config.maxExecutionTime,
    memoryLimitMb: parseInt(options?.memory_limit_mb, 10) || config.maxMemoryMb,
    captureStdout: options?.capture_stdout !== false,
    captureStderr: options?.capture_stderr !== false,
    envVars: options?.env_vars || {},
  };
}

function statusToProto(status: ExecutionStatus): string {
  return status;
}

export function createExecutionService(registry: SkillRegistry): any {
  return {
    ExecuteSkill: async (call: grpc.ServerWritableStream<any, any>) => {
      const { skill_id, script_path, script_type, parameters = {}, options = {} } = call.request;
      const executionId = uuidv4();
      
      logger.info(`Starting execution [${executionId}] for skill: ${skill_id}, script: ${script_path}`);
      
      try {
        // Get skill
        const skill = registry.getSkill(skill_id);
        if (!skill) {
          call.write({
            execution_id: executionId,
            status: 'FAILED',
            result: {
              exit_code: 1,
              stderr: 'Skill not found',
            },
          });
          call.end();
          return;
        }
        
        // Get executor
        const scriptType = parseScriptType(script_type);
        const executor = executors[scriptType];
        if (!executor) {
          call.write({
            execution_id: executionId,
            status: 'FAILED',
            result: {
              exit_code: 1,
              stderr: `Unsupported script type: ${scriptType}`,
            },
          });
          call.end();
          return;
        }
        
        const execOptions = parseExecutionOptions(options);
        
        // Execute
        const generator = executor.execute({
          skillId: skill_id,
          scriptPath: script_path,
          scriptType,
          parameters,
          options: execOptions,
          skillBaseDir: skill.basePath,
          executionId,
        });
        
        for await (const output of generator) {
          const response: any = {
            execution_id: output.executionId,
            status: statusToProto(output.status || ExecutionStatus.RUNNING),
          };
          
          if (output.type === 'STREAM' && output.stream) {
            response.stream = {
              type: output.stream.type,
              content: output.stream.content,
              timestamp: output.stream.timestamp.toString(),
            };
          }
          
          if (output.type === 'RESULT' && output.result) {
            response.result = {
              exit_code: output.result.exitCode,
              stdout: output.result.stdout,
              stderr: output.result.stderr,
              artifacts: output.result.artifacts.map((a: Artifact) => ({
                id: a.id,
                filename: a.filename,
                mime_type: a.mimeType,
                size: a.size.toString(),
                download_url: a.downloadUrl,
                checksum: a.checksum,
              })),
              execution_time_ms: output.result.executionTimeMs.toString(),
              metadata: output.result.metadata,
            };
            
            // Store result for later retrieval
            executionResults.set(executionId, output.result);
          }
          
          if (output.type === 'ERROR') {
            response.result = {
              exit_code: 1,
              stderr: output.error,
            };
          }
          
          call.write(response);
        }
        
        call.end();
        logger.info(`Execution completed [${executionId}]`);
      } catch (error: any) {
        logger.error(`Execution error [${executionId}]:`, error);
        call.write({
          execution_id: executionId,
          status: 'FAILED',
          result: {
            exit_code: 1,
            stderr: error.message,
          },
        });
        call.end();
      }
    },

    CancelExecution: async (
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) => {
      const { execution_id } = call.request;
      
      logger.info(`Cancelling execution: ${execution_id}`);
      
      let cancelled = false;
      for (const executor of Object.values(executors)) {
        if (await executor.cancel(execution_id)) {
          cancelled = true;
          break;
        }
      }
      
      callback(null, {
        cancelled,
        status: {
          code: cancelled ? 0 : 1,
          message: cancelled ? 'Execution cancelled' : 'Execution not found',
        },
      });
    },

    GetExecutionStatus: (
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) => {
      const { execution_id } = call.request;
      
      // Check active executions
      for (const executor of Object.values(executors)) {
        const status = executor.getStatus(execution_id);
        if (status) {
          callback(null, {
            execution_id,
            status: statusToProto(status),
            response_status: { code: 0, message: 'Success' },
          });
          return;
        }
      }
      
      // Check completed results
      const result = executionResults.get(execution_id);
      if (result) {
        callback(null, {
          execution_id,
          status: 'COMPLETED',
          result: {
            exit_code: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            artifacts: result.artifacts.map((a) => ({
              id: a.id,
              filename: a.filename,
              mime_type: a.mimeType,
              size: a.size.toString(),
              download_url: a.downloadUrl,
              checksum: a.checksum,
            })),
            execution_time_ms: result.executionTimeMs.toString(),
            metadata: result.metadata,
          },
          response_status: { code: 0, message: 'Success' },
        });
        return;
      }
      
      callback(null, {
        execution_id,
        response_status: { code: 2, message: 'Execution not found' },
      });
    },
  };
}
