# agentskills-proxy-sdk

TypeScript/JavaScript SDK for AgentSkills-Proxy, providing client functionality to communicate with AgentSkills-Proxy services.

## Features

- **Skill Discovery**: List, search, and get details of available skills
- **Skill Execution**: Execute skills synchronously or with streaming output
- **Execution Management**: Cancel executions and get execution status
- **TypeScript Support**: Full TypeScript type definitions
- **gRPC-Based**: Efficient communication with AgentSkills-Proxy server

## Installation

```bash
npm install agentskills-proxy-sdk
```

## Usage

### Basic Usage

```typescript
import { AgentSkillsProxy, ExecuteSkillRequest } from 'agentskills-proxy-sdk';

// Create client instance
const client = new AgentSkillsProxy({
  host: 'localhost',  // AgentSkills-Proxy server host
  port: 50051         // AgentSkills-Proxy server port
});

// Connect to server
await client.connect();

// Example 1: List available skills
const skills = await client.listSkills({
  page: 1,
  pageSize: 10
});
console.log('Available skills:', skills);

// Example 2: Execute a skill
const executeRequest: ExecuteSkillRequest = {
  skillId: 'example-skill',
  scriptPath: 'scripts/hello.js',
  scriptType: 'JAVASCRIPT',
  parameters: {
    name: 'World'
  },
  options: {
    timeoutSeconds: 30,
    memoryLimitMb: 128
  }
};

const executionResult = await client.executeSkill(executeRequest);
console.log('Execution result:', executionResult);

// Example 3: Execute skill with streaming
await client.executeSkillStream(executeRequest, (message) => {
  console.log('Stream message:', message);
});

// Close client connection when done
client.close();
```

### Configuration Options

```typescript
interface SkillProxyConfig {
  host?: string;              // gRPC server host, default: 'localhost'
  port?: number;              // gRPC server port, default: 50051
  credentials?: grpc.ChannelCredentials;  // gRPC channel credentials
  protoPath?: string;         // Path to proto files, default: './proto'
}
```

## API Reference

### AgentSkillsProxy Class

#### Constructor

```typescript
new AgentSkillsProxy(config?: SkillProxyConfig)
```

#### Methods

##### connect()
```typescript
async connect(): Promise<void>
```
Connects to the AgentSkills-Proxy server.

##### listSkills()
```typescript
async listSkills(request?: ListSkillsRequest): Promise<any>
```
Lists available skills with pagination support.

##### searchSkills()
```typescript
async searchSkills(request: SearchSkillsRequest): Promise<any>
```
Searches for skills by query string.

##### getSkillDetails()
```typescript
async getSkillDetails(request: GetSkillDetailsRequest): Promise<any>
```
Gets detailed information about a specific skill.

##### executeSkill()
```typescript
async executeSkill(request: ExecuteSkillRequest): Promise<any>
```
Executes a skill and returns the result.

##### executeSkillStream()
```typescript
async executeSkillStream(
  request: ExecuteSkillRequest, 
  onMessage: (message: any) => void
): Promise<any>
```
Executes a skill with streaming output.

##### cancelExecution()
```typescript
async cancelExecution(executionId: string): Promise<any>
```
Cancels a running execution.

##### getExecutionStatus()
```typescript
async getExecutionStatus(executionId: string): Promise<any>
```
Gets the status of an execution.

##### close()
```typescript
close(): void
```
Closes the client connection.

## Request Interfaces

### ListSkillsRequest
```typescript
interface ListSkillsRequest {
  page?: number;        // Page number, default: 1
  pageSize?: number;    // Page size, default: 10
  tags?: string[];      // Tag filters
}
```

### SearchSkillsRequest
```typescript
interface SearchSkillsRequest {
  query: string;        // Search query string
  tags?: string[];      // Tag filters
  limit?: number;       // Result limit, default: 10
}
```

### GetSkillDetailsRequest
```typescript
interface GetSkillDetailsRequest {
  skillId: string;      // Skill ID
  level?: 'METADATA_ONLY' | 'WITH_INSTRUCTIONS' | 'FULL_RESOURCES';  // Load level
}
```

### ExecuteSkillRequest
```typescript
interface ExecuteSkillRequest {
  skillId: string;      // Skill ID
  scriptPath: string;   // Script path
  scriptType: 'JAVASCRIPT' | 'PYTHON' | 'SHELL';  // Script type
  parameters?: Record<string, string>;  // Script parameters
  options?: {
    timeoutSeconds?: number;  // Timeout in seconds, default: 60
    memoryLimitMb?: number;   // Memory limit in MB, default: 256
    captureStdout?: boolean;  // Capture stdout, default: true
    captureStderr?: boolean;  // Capture stderr, default: true
  };
}
```

## Example: Complete Workflow

```typescript
import { AgentSkillsProxy } from 'agentskills-proxy-sdk';

async function main() {
  // Initialize client
  const client = new AgentSkillsProxy({
    host: 'localhost',
    port: 50051
  });

  try {
    // Connect to server
    await client.connect();
    console.log('Connected to AgentSkills-Proxy server');

    // List available skills
    const skills = await client.listSkills();
    console.log('Available skills:', skills.skills?.map((skill: any) => skill.skill_id));

    // Search for specific skills
    const searchResults = await client.searchSkills({
      query: 'example',
      limit: 5
    });
    console.log('Search results:', searchResults.skills);

    // Execute a skill
    const executionResult = await client.executeSkill({
      skillId: 'example-skill',
      scriptPath: 'scripts/hello.js',
      scriptType: 'JAVASCRIPT',
      parameters: {
        name: 'Developer'
      }
    });
    console.log('Execution result:', executionResult);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close connection
    client.close();
    console.log('Connection closed');
  }
}

main();
```

## Error Handling

The SDK throws errors for various failure scenarios:

- Connection errors: When unable to connect to the server
- Execution errors: When skill execution fails
- Validation errors: When request parameters are invalid
- Timeout errors: When operations exceed time limits

Always wrap SDK calls in try-catch blocks to handle these errors appropriately.

## Requirements

- Node.js 16.x or later
- AgentSkills-Proxy server running and accessible

## Dependencies

- @grpc/grpc-js: ^1.14.3
- @grpc/proto-loader: ^0.7.15

## License

MIT
