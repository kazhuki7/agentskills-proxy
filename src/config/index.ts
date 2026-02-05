export interface Config {
  grpcPort: number;
  httpPort: number;
  skillsDir: string;
  artifactsDir: string;
  logLevel: string;
  maxExecutionTime: number;
  maxMemoryMb: number;
  enableShellExecution: boolean;
  httpHost: string;
}

export const config: Config = {
  grpcPort: parseInt(process.env.GRPC_PORT || '50051', 10),
  httpPort: parseInt(process.env.HTTP_PORT || '5271', 10),
  skillsDir: process.env.SKILLS_DIR || '/app/skills',
  artifactsDir: process.env.ARTIFACTS_DIR || '/app/data',
  logLevel: process.env.LOG_LEVEL || 'info',
  maxExecutionTime: parseInt(process.env.MAX_EXECUTION_TIME || '300', 10),
  maxMemoryMb: parseInt(process.env.MAX_MEMORY_MB || '512', 10),
  enableShellExecution: process.env.ENABLE_SHELL_EXECUTION !== 'false',
  httpHost: process.env.HTTP_HOST || 'localhost',
};

export default config;
