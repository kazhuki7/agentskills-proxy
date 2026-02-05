import { ParsedSkill, SkillMetadata, SkillChangeEvent } from '../../models/skill.model';
import { SkillScanner } from './scanner';
import { SkillParser } from './parser';
import { SkillValidator } from './validator';
import logger from '../../utils/logger';

type SkillChangeCallback = (event: SkillChangeEvent & { skill?: SkillMetadata }) => void;

export class SkillRegistry {
  private skills: Map<string, ParsedSkill> = new Map();
  private scanner: SkillScanner;
  private parser: SkillParser;
  private validator: SkillValidator;
  private changeCallbacks: SkillChangeCallback[] = [];

  constructor(skillsDir: string) {
    this.scanner = new SkillScanner(skillsDir);
    this.parser = new SkillParser();
    this.validator = new SkillValidator();
  }

  async initialize(): Promise<void> {
    logger.info('Initializing skill registry...');
    
    const skillIds = await this.scanner.scanSkills();
    
    for (const skillId of skillIds) {
      await this.loadSkill(skillId);
    }
    
    this.scanner.watchSkills(async (event) => {
      await this.handleSkillChange(event);
    });
    
    logger.info(`Skill registry initialized with ${this.skills.size} skills`);
  }

  async loadSkill(skillId: string): Promise<ParsedSkill | null> {
    try {
      const skillMdPath = this.scanner.getSkillMdPath(skillId);
      const parsedSkill = await this.parser.parseSkillFile(skillMdPath);
      
      const validationResult = await this.validator.validateSkill(parsedSkill);
      if (!validationResult.valid) {
        logger.warn(`Skill ${skillId} validation failed:`, validationResult.errors);
        return null;
      }
      
      this.skills.set(skillId, parsedSkill);
      logger.info(`Loaded skill: ${skillId}`);
      
      return parsedSkill;
    } catch (error) {
      logger.error(`Error loading skill ${skillId}:`, error);
      return null;
    }
  }

  getSkill(skillId: string): ParsedSkill | undefined {
    return this.skills.get(skillId);
  }

  getAllSkills(): ParsedSkill[] {
    return Array.from(this.skills.values());
  }

  getAllMetadata(): SkillMetadata[] {
    return Array.from(this.skills.values()).map((skill) => skill.metadata);
  }

  searchSkills(query: string, tags?: string[]): SkillMetadata[] {
    const queryLower = query.toLowerCase();
    
    return this.getAllMetadata().filter((metadata) => {
      const matchesQuery =
        metadata.name.toLowerCase().includes(queryLower) ||
        metadata.description.toLowerCase().includes(queryLower);
      
      const matchesTags =
        !tags ||
        tags.length === 0 ||
        tags.some((tag) => metadata.tags.includes(tag));
      
      return matchesQuery && matchesTags;
    });
  }

  onSkillChange(callback: SkillChangeCallback): void {
    this.changeCallbacks.push(callback);
  }

  removeChangeCallback(callback: SkillChangeCallback): void {
    const index = this.changeCallbacks.indexOf(callback);
    if (index > -1) {
      this.changeCallbacks.splice(index, 1);
    }
  }

  private async handleSkillChange(event: SkillChangeEvent): Promise<void> {
    const { type, skillId } = event;
    let skill: SkillMetadata | undefined;
    
    switch (type) {
      case 'ADDED':
      case 'UPDATED':
        const parsedSkill = await this.loadSkill(skillId);
        skill = parsedSkill?.metadata;
        break;
      
      case 'DELETED':
        skill = this.skills.get(skillId)?.metadata;
        this.skills.delete(skillId);
        logger.info(`Removed skill: ${skillId}`);
        break;
    }
    
    for (const callback of this.changeCallbacks) {
      callback({ ...event, skill });
    }
  }

  shutdown(): void {
    this.scanner.stopWatching();
    this.changeCallbacks = [];
    logger.info('Skill registry shutdown');
  }
}

export default SkillRegistry;
