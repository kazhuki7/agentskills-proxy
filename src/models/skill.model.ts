export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  tags: string[];
  author: string;
  license: string;
  allowedTools: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SkillInstructions {
  markdownContent: string;
  allowedTools: string[];
  parameters: Record<string, SkillParameter>;
  examples: string[];
}

export interface SkillParameter {
  type: string;
  required: boolean;
  default?: string;
  description?: string;
}

export interface FileReference {
  path: string;
  type: string;
  size: number;
  checksum: string;
  fullPath: string;
}

export interface SkillResources {
  scripts: FileReference[];
  assets: FileReference[];
  references: FileReference[];
  downloadBaseUrl?: string;
}

export interface ParsedSkill {
  metadata: SkillMetadata;
  instructions: SkillInstructions;
  resources: SkillResources;
  basePath: string;
}

export interface SkillFrontmatter {
  name: string;
  description: string;
  version?: string;
  author?: string;
  license?: string;
  tags?: string[];
  'allowed-tools'?: string[];
  parameters?: Record<string, SkillParameter>;
}

export enum LoadLevel {
  METADATA_ONLY = 0,
  WITH_INSTRUCTIONS = 1,
  FULL_RESOURCES = 2,
}

export enum ScriptType {
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  SHELL = 'shell',
}

export interface ExecutionRequest {
  skillId: string;
  scriptPath: string;
  scriptType: ScriptType;
  parameters: Record<string, string>;
  options: ExecutionOptions;
}

export interface ExecutionOptions {
  timeoutSeconds: number;
  memoryLimitMb: number;
  captureStdout: boolean;
  captureStderr: boolean;
  envVars: Record<string, string>;
}

export interface ExecutionOutput {
  type: 'STATUS' | 'STREAM' | 'RESULT' | 'ERROR';
  executionId: string;
  status?: ExecutionStatus;
  stream?: StreamOutput;
  result?: ExecutionResult;
  error?: string;
}

export enum ExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
}

export interface StreamOutput {
  type: 'STDOUT' | 'STDERR' | 'LOG';
  content: string;
  timestamp: number;
}

export interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  artifacts: Artifact[];
  executionTimeMs: number;
  metadata: Record<string, string>;
}

export interface Artifact {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  downloadUrl: string;
  checksum: string;
  fullPath: string;
}

export interface SkillChangeEvent {
  type: 'ADDED' | 'UPDATED' | 'DELETED';
  skillId: string;
  path: string;
}
