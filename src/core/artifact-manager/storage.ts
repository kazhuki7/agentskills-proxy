import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import logger from '../../utils/logger';

export interface StoredArtifact {
  id: string;
  executionId: string;
  filename: string;
  fullPath: string;
  size: number;
  createdAt: number;
}

export class ArtifactStorage {
  private artifacts: Map<string, StoredArtifact> = new Map();

  async initialize(): Promise<void> {
    await fs.mkdir(config.artifactsDir, { recursive: true });
    logger.info(`Artifact storage initialized at ${config.artifactsDir}`);
  }

  async createArtifactDir(executionId: string): Promise<string> {
    const dir = path.join(config.artifactsDir, executionId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async storeArtifact(
    executionId: string,
    filename: string,
    content: Buffer | string
  ): Promise<StoredArtifact> {
    const artifactId = uuidv4();
    const artifactDir = await this.createArtifactDir(executionId);
    const fullPath = path.join(artifactDir, filename);

    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    await fs.writeFile(fullPath, buffer);

    const artifact: StoredArtifact = {
      id: artifactId,
      executionId,
      filename,
      fullPath,
      size: buffer.length,
      createdAt: Date.now(),
    };

    this.artifacts.set(artifactId, artifact);
    return artifact;
  }

  getArtifact(artifactId: string): StoredArtifact | undefined {
    return this.artifacts.get(artifactId);
  }

  async getArtifactContent(artifactId: string): Promise<Buffer | null> {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) {
      return null;
    }

    try {
      return await fs.readFile(artifact.fullPath);
    } catch {
      return null;
    }
  }

  async deleteArtifact(artifactId: string): Promise<boolean> {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) {
      return false;
    }

    try {
      await fs.unlink(artifact.fullPath);
      this.artifacts.delete(artifactId);
      return true;
    } catch {
      return false;
    }
  }

  async cleanupOldArtifacts(maxAgeMs: number = 3600000): Promise<number> {
    const now = Date.now();
    let deleted = 0;

    try {
      const entries = await fs.readdir(config.artifactsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(config.artifactsDir, entry.name);
          const stat = await fs.stat(dirPath);

          if (now - stat.mtimeMs > maxAgeMs) {
            await fs.rm(dirPath, { recursive: true, force: true });
            deleted++;
            logger.debug(`Cleaned up artifact directory: ${entry.name}`);
          }
        }
      }
    } catch (error) {
      logger.error('Error cleaning up artifacts:', error);
    }

    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} old artifact directories`);
    }

    return deleted;
  }

  startCleanupScheduler(intervalMs: number = 3600000, maxAgeMs: number = 3600000): NodeJS.Timeout {
    return setInterval(() => {
      this.cleanupOldArtifacts(maxAgeMs);
    }, intervalMs);
  }
}

export default ArtifactStorage;
