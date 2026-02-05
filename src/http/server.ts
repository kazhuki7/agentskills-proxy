import express, { Application, Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { SkillRegistry } from '../core/skill-manager/registry';
import { FileReference } from '../models/skill.model';
import { config } from '../config';
import logger from '../utils/logger';

export class HttpServer {
  private app: Application;
  private server: any;
  private registry: SkillRegistry;

  constructor(registry: SkillRegistry) {
    this.registry = registry;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    
    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });

    // CORS
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        skillCount: this.registry.getAllMetadata().length,
      });
    });

    // Download skill resource
    this.app.get('/download/:skillId/*', (req: Request, res: Response) => {
      const { skillId } = req.params;
      const filePath = req.params[0];

      if (!filePath || filePath.includes('..')) {
        res.status(400).json({ error: 'Invalid file path' });
        return;
      }

      const skill = this.registry.getSkill(skillId);
      if (!skill) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      const fullPath = path.join(skill.basePath, filePath);
      const normalizedPath = path.normalize(fullPath);

      // Security: Ensure path is within skill directory
      if (!normalizedPath.startsWith(skill.basePath)) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      if (!fs.existsSync(normalizedPath)) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const stat = fs.statSync(normalizedPath);
      const fileName = path.basename(normalizedPath);

      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', this.getMimeType(fileName));

      const stream = fs.createReadStream(normalizedPath);
      stream.pipe(res);

      stream.on('error', (error) => {
        logger.error(`Error streaming file: ${normalizedPath}`, error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream file' });
        }
      });
    });

    // Download artifact
    this.app.get('/download/artifacts/:executionId/:filename', (req: Request, res: Response) => {
      const { executionId, filename } = req.params;

      if (filename.includes('..') || filename.includes('/')) {
        res.status(400).json({ error: 'Invalid filename' });
        return;
      }

      const artifactPath = path.join(config.artifactsDir, executionId, filename);
      const normalizedPath = path.normalize(artifactPath);

      // Security: Ensure path is within artifacts directory
      if (!normalizedPath.startsWith(config.artifactsDir)) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      if (!fs.existsSync(normalizedPath)) {
        res.status(404).json({ error: 'Artifact not found' });
        return;
      }

      const stat = fs.statSync(normalizedPath);

      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', this.getMimeType(filename));

      const stream = fs.createReadStream(normalizedPath);
      stream.pipe(res);

      stream.on('error', (error) => {
        logger.error(`Error streaming artifact: ${normalizedPath}`, error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream artifact' });
        }
      });
    });

    // List skills (simple REST endpoint)
    this.app.get('/api/skills', (req: Request, res: Response) => {
      const skills = this.registry.getAllMetadata();
      res.json({
        skills,
        total: skills.length,
      });
    });

    // Get skill details
    this.app.get('/api/skills/:skillId', (req: Request, res: Response) => {
      const { skillId } = req.params;
      const skill = this.registry.getSkill(skillId);

      if (!skill) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      res.json({
        metadata: skill.metadata,
        instructions: skill.instructions,
        resources: {
          scripts: skill.resources.scripts.map((f: FileReference) => ({
            path: f.path,
            type: f.type,
            size: f.size,
            downloadUrl: `/download/${skillId}/${f.path}`,
          })),
          assets: skill.resources.assets.map((f: FileReference) => ({
            path: f.path,
            type: f.type,
            size: f.size,
            downloadUrl: `/download/${skillId}/${f.path}`,
          })),
          references: skill.resources.references.map((f: FileReference) => ({
            path: f.path,
            type: f.type,
            size: f.size,
            downloadUrl: `/download/${skillId}/${f.path}`,
          })),
        },
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('HTTP error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.ts': 'text/typescript',
      '.py': 'text/x-python',
      '.sh': 'text/x-shellscript',
      '.md': 'text/markdown',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.xml': 'application/xml',
      '.csv': 'text/csv',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(config.httpPort, () => {
        logger.info(`HTTP server started on port ${config.httpPort}`);
        resolve();
      });
    });
  }

  shutdown(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server shutdown');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export default HttpServer;
