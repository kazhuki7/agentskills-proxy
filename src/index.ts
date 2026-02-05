import { config } from './config';
import { SkillRegistry } from './core/skill-manager/registry';
import { ArtifactStorage } from './core/artifact-manager/storage';
import { GrpcServer } from './grpc/server';
import { HttpServer } from './http/server';
import logger from './utils/logger';

class Application {
  private registry: SkillRegistry;
  private artifactStorage: ArtifactStorage;
  private grpcServer: GrpcServer;
  private httpServer: HttpServer;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.registry = new SkillRegistry(config.skillsDir);
    this.artifactStorage = new ArtifactStorage();
    this.grpcServer = new GrpcServer(this.registry);
    this.httpServer = new HttpServer(this.registry);
  }

  async start(): Promise<void> {
    logger.info('Starting Skill Aggregation Framework...');
    logger.info(`Configuration: grpcPort=${config.grpcPort}, httpPort=${config.httpPort}`);
    logger.info(`Skills directory: ${config.skillsDir}`);
    logger.info(`Data directory: ${config.artifactsDir}`);

    // Initialize components
    await this.artifactStorage.initialize();
    await this.registry.initialize();

    // Start servers
    await this.grpcServer.start();
    await this.httpServer.start();

    // Start artifact cleanup scheduler (every hour, clean artifacts older than 1 hour)
    this.cleanupInterval = this.artifactStorage.startCleanupScheduler(3600000, 3600000);

    logger.info('Skill Aggregation Framework started successfully');
    logger.info(`gRPC server listening on port ${config.grpcPort}`);
    logger.info(`HTTP server listening on port ${config.httpPort}`);
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Skill Aggregation Framework...');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    await this.httpServer.shutdown();
    await this.grpcServer.shutdown();
    this.registry.shutdown();

    logger.info('Skill Aggregation Framework shutdown complete');
  }
}

// Main entry point
const app = new Application();

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  await app.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal');
  await app.shutdown();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Start application
app.start().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});
