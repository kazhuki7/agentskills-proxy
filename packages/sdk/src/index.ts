/**
 * TypeScript/JavaScript SDK for AgentSkills-Proxy
 * 提供与 AgentSkills-Proxy 服务通信的客户端功能
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';

/**
 * SDK 配置接口
 * @interface SkillProxyConfig
 * @property {string} [host] - gRPC 服务器主机地址，默认为 'localhost'
 * @property {number} [port] - gRPC 服务器端口，默认为 50051
 * @property {grpc.ChannelCredentials} [credentials] - gRPC 通道凭证，默认为不安全连接
 * @property {string} [protoPath] - proto 文件路径，默认为 './proto'
 */
export interface SkillProxyConfig {
  host?: string;
  port?: number;
  credentials?: grpc.ChannelCredentials;
  protoPath?: string;
}

/**
 * 执行技能请求接口
 * @interface ExecuteSkillRequest
 * @property {string} skillId - 技能 ID
 * @property {string} scriptPath - 脚本路径
 * @property {string} scriptType - 脚本类型：'JAVASCRIPT' | 'PYTHON' | 'SHELL'
 * @property {Record<string, string>} [parameters] - 脚本参数
 * @property {Object} [options] - 执行选项
 * @property {number} [options.timeoutSeconds] - 超时时间（秒），默认为 60
 * @property {number} [options.memoryLimitMb] - 内存限制（MB），默认为 256
 * @property {boolean} [options.captureStdout] - 是否捕获标准输出，默认为 true
 * @property {boolean} [options.captureStderr] - 是否捕获标准错误，默认为 true
 */
export interface ExecuteSkillRequest {
  skillId: string;
  scriptPath: string;
  scriptType: 'JAVASCRIPT' | 'PYTHON' | 'SHELL';
  parameters?: Record<string, string>;
  options?: {
    timeoutSeconds?: number;
    memoryLimitMb?: number;
    captureStdout?: boolean;
    captureStderr?: boolean;
  };
}

/**
 * 列出技能请求接口
 * @interface ListSkillsRequest
 * @property {number} [page] - 页码，默认为 1
 * @property {number} [pageSize] - 每页大小，默认为 10
 * @property {string[]} [tags] - 标签过滤
 */
export interface ListSkillsRequest {
  page?: number;
  pageSize?: number;
  tags?: string[];
}

/**
 * 搜索技能请求接口
 * @interface SearchSkillsRequest
 * @property {string} query - 搜索查询字符串
 * @property {string[]} [tags] - 标签过滤
 * @property {number} [limit] - 结果限制，默认为 10
 */
export interface SearchSkillsRequest {
  query: string;
  tags?: string[];
  limit?: number;
}

/**
 * 获取技能详情请求接口
 * @interface GetSkillDetailsRequest
 * @property {string} skillId - 技能 ID
 * @property {string} [level] - 加载级别：'METADATA_ONLY' | 'WITH_INSTRUCTIONS' | 'FULL_RESOURCES'，默认为 'METADATA_ONLY'
 */
export interface GetSkillDetailsRequest {
  skillId: string;
  level?: 'METADATA_ONLY' | 'WITH_INSTRUCTIONS' | 'FULL_RESOURCES';
}

/**
 * 技能代理客户端接口
 * @interface SkillProxyClient
 */
export interface SkillProxyClient {
  /**
   * 列出所有可用技能
   * @param {ListSkillsRequest} request - 请求参数
   * @returns {Promise<any>} 技能列表响应
   */
  listSkills(request: ListSkillsRequest): Promise<any>;
  
  /**
   * 搜索技能
   * @param {SearchSkillsRequest} request - 请求参数
   * @returns {Promise<any>} 搜索结果响应
   */
  searchSkills(request: SearchSkillsRequest): Promise<any>;
  
  /**
   * 获取技能详情
   * @param {GetSkillDetailsRequest} request - 请求参数
   * @returns {Promise<any>} 技能详情响应
   */
  getSkillDetails(request: GetSkillDetailsRequest): Promise<any>;
  
  /**
   * 执行技能
   * @param {ExecuteSkillRequest} request - 请求参数
   * @returns {Promise<any>} 执行结果响应
   */
  executeSkill(request: ExecuteSkillRequest): Promise<any>;
  
  /**
   * 取消执行
   * @param {string} executionId - 执行 ID
   * @returns {Promise<any>} 取消结果响应
   */
  cancelExecution(executionId: string): Promise<any>;
  
  /**
   * 获取执行状态
   * @param {string} executionId - 执行 ID
   * @returns {Promise<any>} 执行状态响应
   */
  getExecutionStatus(executionId: string): Promise<any>;
  
  /**
   * 流式执行技能
   * @param {ExecuteSkillRequest} request - 请求参数
   * @param {Function} onMessage - 消息回调函数
   * @returns {Promise<any>} 执行结果响应
   */
  executeSkillStream(request: ExecuteSkillRequest, onMessage: (message: any) => void): Promise<any>;
  
  /**
   * 关闭客户端连接
   */
  close(): void;
}

/**
 * AgentSkills-Proxy 客户端实现
 * @class AgentSkillsProxy
 * @implements {SkillProxyClient}
 */
export class AgentSkillsProxy implements SkillProxyClient {
  private readonly config: SkillProxyConfig;
  private readonly grpcHost: string;
  private discoveryClient: any;
  private executionClient: any;
  private proto: any;

  /**
   * 构造函数
   * @param {SkillProxyConfig} [config] - 配置参数
   */
  constructor(config: SkillProxyConfig = {}) {
    this.config = {
      host: 'localhost',
      port: 50051,
      credentials: grpc.credentials.createInsecure(),
      protoPath: path.resolve('./proto'), // Use absolute path
      ...config
    } as SkillProxyConfig;

    this.grpcHost = `${this.config.host}:${this.config.port}`;
  }

  /**
   * 连接到 AgentSkills-Proxy 服务
   * @async
   * @returns {Promise<void>}
   */
  async connect() {
    // Load proto definitions using absolute path
    const discoveryProto = protoLoader.loadSync(
      path.join(this.config.protoPath!, 'skill_discovery.proto'),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [this.config.protoPath!]
      }
    );

    const executionProto = protoLoader.loadSync(
      path.join(this.config.protoPath!, 'skill_execution.proto'),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [this.config.protoPath!]
      }
    );

    const discoveryPackage: any = grpc.loadPackageDefinition(discoveryProto).skillframework;
    const executionPackage: any = grpc.loadPackageDefinition(executionProto).skillframework;

    // Create clients
    this.discoveryClient = new discoveryPackage.SkillDiscoveryService(
      this.grpcHost,
      this.config.credentials!
    );

    this.executionClient = new executionPackage.SkillExecutionService(
      this.grpcHost,
      this.config.credentials!
    );
  }

  /**
   * 列出所有可用技能
   * @async
   * @param {ListSkillsRequest} [request] - 请求参数
   * @returns {Promise<any>} 技能列表响应
   */
  async listSkills(request: ListSkillsRequest = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      this.discoveryClient.ListSkills({
        page: request.page ?? 1,
        page_size: request.pageSize ?? 10,
        tags: request.tags ?? []
      } as any, (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * 搜索技能
   * @async
   * @param {SearchSkillsRequest} request - 请求参数
   * @returns {Promise<any>} 搜索结果响应
   */
  async searchSkills(request: SearchSkillsRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      this.discoveryClient.SearchSkills({
        query: request.query,
        tags: request.tags ?? [],
        limit: request.limit ?? 10
      } as any, (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * 获取技能详情
   * @async
   * @param {GetSkillDetailsRequest} request - 请求参数
   * @returns {Promise<any>} 技能详情响应
   */
  async getSkillDetails(request: GetSkillDetailsRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      this.discoveryClient.GetSkillDetails({
        skill_id: request.skillId,
        level: this.convertLoadLevel(request.level || 'METADATA_ONLY')
      } as any, (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * 执行技能
   * @async
   * @param {ExecuteSkillRequest} request - 请求参数
   * @returns {Promise<any>} 执行结果响应
   */
  async executeSkill(request: ExecuteSkillRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        skill_id: request.skillId,
        script_path: request.scriptPath,
        script_type: request.scriptType,
        parameters: request.parameters || {},
        options: {
          timeout_seconds: request.options?.timeoutSeconds || 60,
          memory_limit_mb: request.options?.memoryLimitMb || 256,
          capture_stdout: request.options?.captureStdout !== false,
          capture_stderr: request.options?.captureStderr !== false,
          env_vars: {}
        }
      } as any;

      this.executionClient.ExecuteSkill(grpcRequest, (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * 流式执行技能
   * @async
   * @param {ExecuteSkillRequest} request - 请求参数
   * @param {Function} onMessage - 消息回调函数
   * @returns {Promise<any>} 执行结果响应
   */
  async executeSkillStream(request: ExecuteSkillRequest, onMessage: (message: any) => void): Promise<any> {
    const grpcRequest = {
      skill_id: request.skillId,
      script_path: request.scriptPath,
      script_type: request.scriptType,
      parameters: request.parameters || {},
      options: {
        timeout_seconds: request.options?.timeoutSeconds || 60,
        memory_limit_mb: request.options?.memoryLimitMb || 256,
        capture_stdout: request.options?.captureStdout !== false,
        capture_stderr: request.options?.captureStderr !== false,
        env_vars: {}
      }
    } as any;

    const call = this.executionClient.ExecuteSkill(grpcRequest);
    
    return new Promise((resolve, reject) => {
      call.on('data', (response: any) => {
        onMessage(response);
      });

      call.on('error', (err: any) => {
        reject(err);
      });

      call.on('end', () => {
        resolve(null);
      });
    });
  }

  /**
   * 取消执行
   * @async
   * @param {string} executionId - 执行 ID
   * @returns {Promise<any>} 取消结果响应
   */
  async cancelExecution(executionId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.executionClient.CancelExecution({
        execution_id: executionId
      } as any, (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * 获取执行状态
   * @async
   * @param {string} executionId - 执行 ID
   * @returns {Promise<any>} 执行状态响应
   */
  async getExecutionStatus(executionId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.executionClient.GetExecutionStatus({
        execution_id: executionId
      } as any, (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * 转换加载级别为数字
   * @private
   * @param {string} level - 加载级别字符串
   * @returns {number} 对应的数字值
   */
  private convertLoadLevel(level: string): number {
    switch (level) {
      case 'METADATA_ONLY': return 0;
      case 'WITH_INSTRUCTIONS': return 1;
      case 'FULL_RESOURCES': return 2;
      default: return 0;
    }
  }

  /**
   * 关闭客户端连接
   */
  close(): void {
    if (this.discoveryClient) {
      this.discoveryClient.close();
    }
    if (this.executionClient) {
      this.executionClient.close();
    }
  }
}

export default AgentSkillsProxy;
