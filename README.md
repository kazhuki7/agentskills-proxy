# AgentSkills-Proxy

A remote proxy server for Agent Skills that enables skill discovery, execution, and data management via gRPC/HTTP. This service bridges local skill capabilities to remote access, allowing AI agents to leverage various tools and capabilities through a unified interface.

[中文文档](README_zh.md)

## Features

- **gRPC/HTTP Interface**: Dual protocol support for maximum compatibility
- **Skill Discovery**: Dynamic scanning and registration of skills via SKILL.md files
- **Secure Execution**: Sandboxed execution environment with resource limits
- **Multi-language Support**: JavaScript (VM2), Python, and Shell script execution
- **Streaming Output**: Real-time execution feedback via streaming
- **Data Management**: Automatic handling of generated files and results
- **Progressive Loading**: Hierarchical skill information loading (metadata → instructions → resources)

## Architecture

```
┌─────────────┐    gRPC/HTTP     ┌────────────────────────────┐
│   Agent     │ ◄──────────────► │  AgentSkills-Proxy         │
│             │                  │                            │
└─────────────┘                  │ • Skill Registry           │
                                 │ • Execution Engine         │
┌─────────────┐    Skills       │ • Artifact Manager         │
│   Skills    │ ──────────────► │ • gRPC Server              │
│ (SKILL.md)  │                 │ • HTTP API                 │
└─────────────┘                 └────────────────────────────┘
```

## Supported Skills

- **example-skill**: JavaScript/Python/Shell script execution demo (included for testing)

## Prerequisites

- Docker & Docker Compose
- Node.js (for SDK development)

## Quick Start

### 1. Clone and Build

```bash
git clone <repository-url>
cd agentskills-proxy
```

### 2. Start the Service

```bash
# Build and start the service
docker compose up -d

# Verify service is running
docker compose ps
```

The service will be available at:
- gRPC: `localhost:50051`
- HTTP: `http://localhost:5271` (Note: HTTP port defaults to 5271 when using default config)

### 3. Verify Installation

```bash
# Health check
curl http://localhost:5271/health

# List available skills
curl http://localhost:5271/api/skills
```

The service will show 1 skill (example-skill) by default. Additional skills can be added by placing them in the `skills/` directory.

## SDK Usage

### Installation

```bash
npm install agentskills-proxy-sdk
```

### Example

```javascript
import { AgentSkillsProxy } from 'agentskills-proxy-sdk';

const client = new AgentSkillsProxy({
  host: 'localhost',
  port: 50051
});

await client.connect();

// List available skills
const skills = await client.listSkills();
console.log(`Available skills: ${skills.skills.length}`);

// Execute a skill
const result = await client.executeSkill({
  skillId: 'example-skill',
  scriptPath: 'scripts/hello.js',
  scriptType: 'JAVASCRIPT',
  parameters: {
    message: 'Hello from SDK!',
    count: '3'
  }
});

client.close();
```

### Streaming Execution

```javascript
await client.executeSkillStream(
  {
    skillId: 'pdf',
    scriptPath: 'scripts/pdf_processor.py',
    scriptType: 'PYTHON',
    parameters: { operation: 'create_sample' }
  },
  (message) => {
    if (message.stream) {
      console.log(`[${message.stream.type}] ${message.stream.content}`);
    }
  }
);
```

## Adding Custom Skills

Skills are automatically discovered from the `skills/` directory. To add a new skill:

1. Create a directory under `skills/` (e.g., `skills/my-skill/`)
2. Add a `SKILL.md` file with skill metadata
3. Add scripts in the `scripts/` subdirectory
4. Restart the service or the new skill will be detected automatically

The `example-skill` is included for demonstration purposes and can be removed in production deployments.

### SKILL.md Template

```markdown
---
name: my-skill
description: "Brief description of the skill"
version: "1.0.0"
author: "Your Name"
license: "MIT"
tags:
  - tag1
  - tag2
allowed-tools:
  - Bash
  - Read
  - Write
parameters:
  input_file:
    type: string
    required: false
    default: ""
    description: "Input file path"
---

# My Skill Documentation

Documentation for the skill goes here...
```

## Configuration

Environment variables can be configured in `.env`:

```bash
# Server configuration
GRPC_PORT=50051
HTTP_PORT=5271
HTTP_HOST=localhost

# Execution limits
MAX_EXECUTION_TIME=300      # seconds
MAX_MEMORY_MB=512           # MB
ENABLE_SHELL_EXECUTION=true

# Directories
SKILLS_DIR=./skills
DATA_DIR=./data
```

## API Reference

### gRPC Services

- `SkillDiscoveryService`: List, search, and get skill details
- `SkillExecutionService`: Execute skills, get status, cancel execution

### HTTP Endpoints

- `GET /health`: Service health check
- `GET /api/skills`: List all skills
- `GET /api/skills/{id}`: Get skill details

## Security

- Execution sandboxes with resource limits
- Whitelist-based script execution
- Isolated execution environment
- File system isolation

## Development

### Project Structure

```
agentskills-proxy/
├── packages/
│   └── sdk/              # TypeScript SDK
├── skills/               # Available skills
├── proto/                # gRPC definitions
├── src/                  # Server implementation
├── data/                 # Generated files
└── docker-compose.yml    # Deployment config
```

### Building from Source

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Build and run with Docker
docker compose up --build -d
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Version

Current version: 1.1.0

See [CHANGELOG](CHANGELOG.md) for version history and release notes.

## License

MIT License - see the [LICENSE](LICENSE) file for details.