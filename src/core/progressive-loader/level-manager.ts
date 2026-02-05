import { LRUCache } from 'lru-cache';
import {
  ParsedSkill,
  SkillMetadata,
  SkillInstructions,
  SkillResources,
  LoadLevel,
} from '../../models/skill.model';
import { SkillRegistry } from '../skill-manager/registry';
import { SkillParser } from '../skill-manager/parser';
import { config } from '../../config';
import logger from '../../utils/logger';

interface CachedSkill {
  metadata: SkillMetadata;
  instructions?: SkillInstructions;
  resources?: SkillResources;
  fullyLoaded: boolean;
}

export interface LoadedSkillData {
  metadata: SkillMetadata;
  instructions?: SkillInstructions;
  resources?: SkillResources;
}

export class ProgressiveLoadManager {
  private cache: LRUCache<string, CachedSkill>;
  private registry: SkillRegistry;
  private parser: SkillParser;

  constructor(registry: SkillRegistry) {
    this.registry = registry;
    this.parser = new SkillParser();
    this.cache = new LRUCache<string, CachedSkill>({
      max: 100,
      ttl: 1000 * 60 * 30, // 30 minutes
    });

    // Invalidate cache on skill changes
    this.registry.onSkillChange((event) => {
      this.cache.delete(event.skillId);
      logger.debug(`Cache invalidated for skill: ${event.skillId}`);
    });
  }

  async loadSkill(skillId: string, level: LoadLevel): Promise<LoadedSkillData | null> {
    const cached = this.cache.get(skillId);

    // Level 1: Metadata only
    if (level === LoadLevel.METADATA_ONLY) {
      if (cached?.metadata) {
        logger.debug(`Cache hit for skill metadata: ${skillId}`);
        return { metadata: cached.metadata };
      }

      const skill = this.registry.getSkill(skillId);
      if (!skill) {
        logger.warn(`Skill not found: ${skillId}`);
        return null;
      }

      this.updateCache(skillId, {
        metadata: skill.metadata,
        fullyLoaded: false,
      });

      return { metadata: skill.metadata };
    }

    // Level 2: Metadata + Instructions
    if (level === LoadLevel.WITH_INSTRUCTIONS) {
      if (cached?.metadata && cached?.instructions) {
        logger.debug(`Cache hit for skill with instructions: ${skillId}`);
        return {
          metadata: cached.metadata,
          instructions: cached.instructions,
        };
      }

      const skill = this.registry.getSkill(skillId);
      if (!skill) {
        logger.warn(`Skill not found: ${skillId}`);
        return null;
      }

      this.updateCache(skillId, {
        metadata: skill.metadata,
        instructions: skill.instructions,
        fullyLoaded: false,
      });

      return {
        metadata: skill.metadata,
        instructions: skill.instructions,
      };
    }

    // Level 3: Full resources
    if (level === LoadLevel.FULL_RESOURCES) {
      if (cached?.fullyLoaded) {
        logger.debug(`Cache hit for full skill: ${skillId}`);
        return {
          metadata: cached.metadata,
          instructions: cached.instructions,
          resources: cached.resources,
        };
      }

      const skill = this.registry.getSkill(skillId);
      if (!skill) {
        logger.warn(`Skill not found: ${skillId}`);
        return null;
      }

      // Generate download URLs
      const baseUrl = `http://${config.httpHost}:${config.httpPort}`;
      const resourcesWithUrls: SkillResources = {
        ...skill.resources,
        downloadBaseUrl: `${baseUrl}/download/${skillId}`,
      };

      this.updateCache(skillId, {
        metadata: skill.metadata,
        instructions: skill.instructions,
        resources: resourcesWithUrls,
        fullyLoaded: true,
      });

      return {
        metadata: skill.metadata,
        instructions: skill.instructions,
        resources: resourcesWithUrls,
      };
    }

    return null;
  }

  private updateCache(skillId: string, data: CachedSkill): void {
    const existing = this.cache.get(skillId);
    this.cache.set(skillId, {
      ...existing,
      ...data,
    });
  }

  clearCache(): void {
    this.cache.clear();
    logger.info('Progressive loader cache cleared');
  }

  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: 100,
    };
  }
}

export default ProgressiveLoadManager;
