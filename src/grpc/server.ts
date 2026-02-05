import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { SkillRegistry } from '../core/skill-manager/registry';
import { ProgressiveLoadManager } from '../core/progressive-loader/level-manager';
import { createDiscoveryService } from './services/discovery.service';
import { createExecutionService } from './services/execution.service';
import { config } from '../config';
import logger from '../utils/logger';

const PROTO_PATH_DISCOVERY = path.join(__dirname, '../../proto/skill_discovery.proto');
const PROTO_PATH_EXECUTION = path.join(__dirname, '../../proto/skill_execution.proto');

export class GrpcServer {
  private server: grpc.Server;
  private registry: SkillRegistry;
  private progressiveLoader: ProgressiveLoadManager;

  constructor(registry: SkillRegistry) {
    this.registry = registry;
    this.progressiveLoader = new ProgressiveLoadManager(registry);
    this.server = new grpc.Server();
  }

  async start(): Promise<void> {
    // Load proto definitions
    const discoveryPackageDef = protoLoader.loadSync(PROTO_PATH_DISCOVERY, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [path.join(__dirname, '../../proto')],
    });

    const executionPackageDef = protoLoader.loadSync(PROTO_PATH_EXECUTION, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [path.join(__dirname, '../../proto')],
    });

    const discoveryProto = grpc.loadPackageDefinition(discoveryPackageDef) as any;
    const executionProto = grpc.loadPackageDefinition(executionPackageDef) as any;

    // Add services
    this.server.addService(
      discoveryProto.skillframework.SkillDiscoveryService.service,
      createDiscoveryService(this.registry, this.progressiveLoader)
    );

    this.server.addService(
      executionProto.skillframework.SkillExecutionService.service,
      createExecutionService(this.registry)
    );

    // Start server
    return new Promise((resolve, reject) => {
      this.server.bindAsync(
        `0.0.0.0:${config.grpcPort}`,
        grpc.ServerCredentials.createInsecure(),
        (error, port) => {
          if (error) {
            logger.error('Failed to start gRPC server:', error);
            reject(error);
            return;
          }
          logger.info(`gRPC server started on port ${port}`);
          resolve();
        }
      );
    });
  }

  async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      this.server.tryShutdown(() => {
        logger.info('gRPC server shutdown');
        resolve();
      });
    });
  }
}

export default GrpcServer;
