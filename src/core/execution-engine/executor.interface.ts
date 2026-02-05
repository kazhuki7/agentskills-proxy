import {
  ExecutionRequest,
  ExecutionOutput,
  ExecutionStatus,
} from '../../models/skill.model';

export interface IExecutor {
  execute(request: ExecutionRequest & { skillBaseDir: string; executionId: string }): AsyncGenerator<ExecutionOutput>;
  cancel(executionId: string): Promise<boolean>;
  getStatus(executionId: string): ExecutionStatus | null;
}

export abstract class BaseExecutor implements IExecutor {
  protected activeExecutions: Map<string, { status: ExecutionStatus; abortController?: AbortController }> = new Map();

  abstract execute(request: ExecutionRequest & { skillBaseDir: string; executionId: string }): AsyncGenerator<ExecutionOutput>;

  async cancel(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false;
    }

    if (execution.abortController) {
      execution.abortController.abort();
    }

    execution.status = ExecutionStatus.CANCELLED;
    return true;
  }

  getStatus(executionId: string): ExecutionStatus | null {
    const execution = this.activeExecutions.get(executionId);
    return execution?.status || null;
  }

  protected setStatus(executionId: string, status: ExecutionStatus, abortController?: AbortController): void {
    this.activeExecutions.set(executionId, { status, abortController });
  }

  protected clearExecution(executionId: string): void {
    this.activeExecutions.delete(executionId);
  }
}
