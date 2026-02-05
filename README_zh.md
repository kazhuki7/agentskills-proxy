# AgentSkills-Proxy

一个用于 Agent Skills 的远程代理服务器，通过 gRPC/HTTP 提供技能发现、执行和数据管理功能。此服务将本地技能能力桥接到远程访问，允许 AI Agent 通过统一接口利用各种工具和能力。

## 功能特性

- **gRPC/HTTP 接口**: 双协议支持以实现最大兼容性
- **技能发现**: 通过 SKILL.md 文件动态扫描和注册技能
- **安全执行**: 带有资源限制的沙盒执行环境
- **多语言支持**: JavaScript (VM2)、Python 和 Shell 脚本执行
- **流式输出**: 通过流式传输实现实时执行反馈
- **数据管理**: 自动生成和管理执行结果文件
- **渐进式加载**: 层次化的技能信息加载（元数据 → 指令 → 资源）

## 架构设计

```
┌─────────────┐    gRPC/HTTP     ┌─────────────────────┐
│   Agent     │ ◄──────────────► │ AgentSkills-Proxy   │
│             │                  │                     │
└─────────────┘                  │ • 技能注册表        │
                                 │ • 执行引擎          │
┌─────────────┐    Skills       │ • 数据管理器        │
│   Skills    │ ──────────────► │ • gRPC 服务器      │
│ (SKILL.md)  │                 │ • HTTP API          │
└─────────────┘                 └─────────────────────┘
```

## 支持的技能

- **example-skill**: JavaScript/Python/Shell 脚本执行演示（随附用于测试）

## 先决条件

- Docker & Docker Compose
- Node.js (用于 SDK 开发)

## 快速开始

### 1. 克隆和构建

```bash
git clone <repository-url>
cd agentskills-proxy
```

### 2. 启动服务

```bash
# 构建并启动服务
docker compose up -d

# 验证服务是否正在运行
docker compose ps
```

服务将在以下地址可用：
- gRPC: `localhost:50051`
- HTTP: `http://localhost:5271` (注意：使用默认配置时 HTTP 端口为 5271)

### 3. 验证安装

```bash
# 健康检查
curl http://localhost:5271/health

# 列出可用技能
curl http://localhost:5271/api/skills
```

服务将显示 1 个技能（example-skill）。可通过将它们放置在 `skills/` 目录中来添加更多技能。

## SDK 使用

### 安装

```bash
# 从 npm 安装
npm install agentskills-proxy-sdk

# 从源码安装（开发版本）
cd agentskills-proxy/packages/sdk
npm install
npm run build
npm link
```

### 快速开始

```javascript
import { AgentSkillsProxy } from 'agentskills-proxy-sdk';

// 创建客户端实例
const client = new AgentSkillsProxy({
  host: 'localhost',      // gRPC 服务器主机地址
  port: 50051,            // gRPC 服务器端口
  protoPath: './proto'    // proto 文件路径（可选）
});

// 连接到服务
await client.connect();

// 列出可用技能
const skills = await client.listSkills();
console.log(`可用技能数量: ${skills.skills.length}`);

// 执行技能
const result = await client.executeSkill({
  skillId: 'example-skill',
  scriptPath: 'scripts/hello.js',
  scriptType: 'JAVASCRIPT',
  parameters: {
    message: '来自 SDK 的问候!',
    count: '3'
  },
  options: {
    timeoutSeconds: 60,
    memoryLimitMb: 256
  }
});

console.log('执行结果:', result);

// 关闭连接
client.close();
```

### 完整 API 文档

#### 1. 构造函数

```javascript
const client = new AgentSkillsProxy(config);
```

**参数**:
- `config` (可选): 配置对象
  - `host`: 服务器主机地址，默认为 'localhost'
  - `port`: 服务器端口，默认为 50051
  - `credentials`: gRPC 通道凭证，默认为不安全连接
  - `protoPath`: proto 文件路径，默认为 './proto'

#### 2. 连接管理

```javascript
// 连接到服务
await client.connect();

// 关闭连接
client.close();
```

#### 3. 技能发现

##### listSkills - 列出所有可用技能

```javascript
const response = await client.listSkills({
  page: 1,         // 页码
  pageSize: 10,    // 每页大小
  tags: ['ai']     // 标签过滤
});
```

##### searchSkills - 搜索技能

```javascript
const response = await client.searchSkills({
  query: 'pdf',    // 搜索关键词
  tags: ['document'], // 标签过滤
  limit: 5         // 结果限制
});
```

##### getSkillDetails - 获取技能详情

```javascript
const response = await client.getSkillDetails({
  skillId: 'example-skill',
  level: 'FULL_RESOURCES' // 加载级别
});
```

**加载级别选项**:
- `METADATA_ONLY`: 仅加载元数据
- `WITH_INSTRUCTIONS`: 加载元数据和指令
- `FULL_RESOURCES`: 加载完整资源

#### 4. 技能执行

##### executeSkill - 执行技能

```javascript
const response = await client.executeSkill({
  skillId: 'example-skill',
  scriptPath: 'scripts/hello.js',
  scriptType: 'JAVASCRIPT',
  parameters: {
    message: 'Hello',
    count: '3'
  },
  options: {
    timeoutSeconds: 60,
    memoryLimitMb: 256,
    captureStdout: true,
    captureStderr: true
  }
});
```

##### executeSkillStream - 流式执行技能

```javascript
await client.executeSkillStream(
  {
    skillId: 'example-skill',
    scriptPath: 'scripts/hello.js',
    scriptType: 'JAVASCRIPT',
    parameters: { message: 'Hello' }
  },
  (message) => {
    if (message.stream) {
      console.log(`[${message.stream.type}] ${message.stream.content}`);
    } else if (message.result) {
      console.log('执行完成:', message.result);
    }
  }
);
```

##### cancelExecution - 取消执行

```javascript
const response = await client.cancelExecution('execution-id-123');
```

##### getExecutionStatus - 获取执行状态

```javascript
const response = await client.getExecutionStatus('execution-id-123');
```

### 高级示例

#### 1. 错误处理

```javascript
try {
  await client.connect();
  const result = await client.executeSkill({
    skillId: 'example-skill',
    scriptPath: 'scripts/hello.js',
    scriptType: 'JAVASCRIPT',
    parameters: { message: 'Hello' }
  });
  console.log('执行成功:', result);
} catch (error) {
  console.error('执行失败:', error.message);
} finally {
  client.close();
}
```

#### 2. 搜索和执行技能

```javascript
// 搜索与 PDF 相关的技能
const searchResults = await client.searchSkills({ query: 'pdf' });

if (searchResults.skills.length > 0) {
  const pdfSkill = searchResults.skills[0];
  console.log('找到 PDF 技能:', pdfSkill.name);
  
  // 执行 PDF 技能
  const result = await client.executeSkill({
    skillId: pdfSkill.id,
    scriptPath: 'scripts/process_pdf.js',
    scriptType: 'JAVASCRIPT',
    parameters: { file: 'document.pdf' }
  });
  
  console.log('PDF 处理结果:', result);
}
```

#### 3. 批量执行技能

```javascript
const skillsToExecute = [
  {
    skillId: 'example-skill',
    scriptPath: 'scripts/hello.js',
    scriptType: 'JAVASCRIPT',
    parameters: { message: 'Task 1' }
  },
  {
    skillId: 'example-skill',
    scriptPath: 'scripts/hello.js',
    scriptType: 'JAVASCRIPT',
    parameters: { message: 'Task 2' }
  }
];

const results = await Promise.all(
  skillsToExecute.map(task => client.executeSkill(task))
);

console.log('批量执行结果:', results);
```

### 最佳实践

1. **错误处理**: 始终使用 try-catch 捕获执行过程中的错误
2. **连接管理**: 使用完毕后及时关闭连接，避免资源泄漏
3. **超时设置**: 根据任务复杂度合理设置超时时间
4. **内存限制**: 根据脚本需求设置适当的内存限制
5. **流式执行**: 对于长时间运行的任务，使用流式执行获取实时反馈
6. **技能发现**: 在执行技能前，先使用 listSkills 或 searchSkills 确认技能存在
7. **参数验证**: 在执行前验证参数格式和内容
8. **错误重试**: 对于网络错误，可以实现简单的重试机制

### 常见问题

#### Q: 连接失败怎么办？
**A**: 检查服务是否正在运行，端口是否正确，网络连接是否正常。

#### Q: 执行超时怎么办？
**A**: 增加 `timeoutSeconds` 参数值，或优化脚本执行效率。

#### Q: 内存不足怎么办？
**A**: 增加 `memoryLimitMb` 参数值，或优化脚本内存使用。

#### Q: 如何获取执行日志？
**A**: 使用流式执行 `executeSkillStream`，在回调函数中处理日志信息。

#### Q: 如何处理大型文件？
**A**: 对于大型文件操作，建议使用流式处理，并设置适当的超时和内存限制。

## 添加自定义技能

技能从 `skills/` 目录自动发现。要添加新技能：

1. 在 `skills/` 下创建一个目录（例如 `skills/my-skill/`）
2. 添加带有技能元数据的 `SKILL.md` 文件
3. 在 `scripts/` 子目录中添加脚本
4. 重启服务或新技能将自动检测

### SKILL.md 模板

```markdown
---
name: my-skill
description: "技能的简要描述"
version: "1.0.0"
author: "你的姓名"
license: "MIT"
tags:
  - 标签1
  - 标签2
allowed-tools:
  - Bash
  - Read
  - Write
parameters:
  input_file:
    type: string
    required: false
    default: ""
    description: "输入文件路径"
---

# 我的技能文档

技能文档内容在这里...
```

## 配置

环境变量可在 `.env` 中配置：

```bash
# 服务器配置
GRPC_PORT=50051
HTTP_PORT=5271
HTTP_HOST=localhost

# 执行限制
MAX_EXECUTION_TIME=300      # 秒
MAX_MEMORY_MB=512           # MB
ENABLE_SHELL_EXECUTION=true

# 目录
SKILLS_DIR=./skills
DATA_DIR=./data
```

## API 参考

### gRPC 服务

- `SkillDiscoveryService`: 列出、搜索和获取技能详情
- `SkillExecutionService`: 执行技能、获取状态、取消执行

### HTTP 端点

- `GET /health`: 服务健康检查
- `GET /api/skills`: 列出所有技能
- `GET /api/skills/{id}`: 获取技能详情

## 安全性

- 带有资源限制的执行沙盒
- 白名单基础的脚本执行
- 隔离的执行环境
- 文件系统隔离

## 开发

### 项目结构

```
agentskills-proxy/
├── packages/
│   └── sdk/              # TypeScript SDK
├── skills/               # 可用技能
├── proto/                # gRPC 定义
├── src/                  # 服务器实现
├── data/                 # 生成的文件
└── docker-compose.yml    # 部署配置
```

### 从源码构建

```bash
# 安装依赖
npm install

# 构建 TypeScript
npm run build

# 使用 Docker 构建和运行
docker compose up --build -d
```

## 版本

当前版本: 1.1.0

参见 [CHANGELOG](CHANGELOG.md) 查看版本历史和发布说明。

## 贡献

1. Fork 仓库
2. 创建功能分支
3. 进行修改
4. 如适用，请添加测试
5. 提交 Pull Request

## 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。