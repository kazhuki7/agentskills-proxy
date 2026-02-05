import * as fs from 'fs/promises';
import * as path from 'path';
import chokidar, { FSWatcher } from 'chokidar';
import { SkillChangeEvent } from '../../models/skill.model';
import logger from '../../utils/logger';

export class SkillScanner {
  private skillsDirectory: string;
  private watcher: FSWatcher | null = null;

  constructor(skillsDir: string) {
    this.skillsDirectory = skillsDir;
  }

  async scanSkills(): Promise<string[]> {
    const skillDirs: string[] = [];
    
    try {
      const entries = await fs.readdir(this.skillsDirectory, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillMdPath = path.join(
            this.skillsDirectory,
            entry.name,
            'SKILL.md'
          );
          
          if (await this.fileExists(skillMdPath)) {
            skillDirs.push(entry.name);
            logger.debug(`Found skill: ${entry.name}`);
          }
        }
      }
      
      logger.info(`Scanned ${skillDirs.length} skills from ${this.skillsDirectory}`);
    } catch (error) {
      logger.error('Error scanning skills directory:', error);
    }
    
    return skillDirs;
  }

  watchSkills(callback: (event: SkillChangeEvent) => void): void {
    const watchPath = path.join(this.skillsDirectory, '*', 'SKILL.md');
    
    this.watcher = chokidar.watch(watchPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    this.watcher
      .on('add', (filePath) => {
        const skillId = this.extractSkillId(filePath);
        logger.info(`Skill added: ${skillId}`);
        callback({ type: 'ADDED', skillId, path: filePath });
      })
      .on('change', (filePath) => {
        const skillId = this.extractSkillId(filePath);
        logger.info(`Skill updated: ${skillId}`);
        callback({ type: 'UPDATED', skillId, path: filePath });
      })
      .on('unlink', (filePath) => {
        const skillId = this.extractSkillId(filePath);
        logger.info(`Skill deleted: ${skillId}`);
        callback({ type: 'DELETED', skillId, path: filePath });
      })
      .on('error', (error) => {
        logger.error('Watcher error:', error);
      });

    logger.info(`Watching for skill changes in ${this.skillsDirectory}`);
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      logger.info('Stopped watching for skill changes');
    }
  }

  getSkillPath(skillId: string): string {
    return path.join(this.skillsDirectory, skillId);
  }

  getSkillMdPath(skillId: string): string {
    return path.join(this.skillsDirectory, skillId, 'SKILL.md');
  }

  private extractSkillId(filePath: string): string {
    const relativePath = path.relative(this.skillsDirectory, filePath);
    return relativePath.split(path.sep)[0];
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export default SkillScanner;
