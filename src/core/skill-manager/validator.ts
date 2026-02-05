import * as fs from 'fs/promises';
import * as path from 'path';
import { ParsedSkill } from '../../models/skill.model';
import logger from '../../utils/logger';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class SkillValidator {
  private dangerousPatterns = [
    /eval\s*\(/,
    /Function\s*\(/,
    /require\s*\(\s*['"]child_process['"]\s*\)/,
    /import\s+.*child_process/,
    /exec\s*\(/,
    /spawn\s*\(/,
    /execSync\s*\(/,
    /spawnSync\s*\(/,
    /__proto__/,
    /constructor\s*\[/,
  ];

  async validateSkill(skill: ParsedSkill): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate metadata
    this.validateMetadata(skill, errors, warnings);
    
    // Validate scripts
    await this.validateScripts(skill, errors, warnings);
    
    // Validate paths
    this.validatePaths(skill, errors);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateMetadata(
    skill: ParsedSkill,
    errors: string[],
    warnings: string[]
  ): void {
    const { metadata } = skill;

    // Name validation
    if (!metadata.name) {
      errors.push('Skill name is required');
    } else if (metadata.name.length > 64) {
      errors.push('Skill name must be 64 characters or less');
    } else if (!/^[a-z][a-z0-9-]*$/.test(metadata.name)) {
      warnings.push('Skill name should be lowercase with hyphens');
    }

    // Description validation
    if (!metadata.description) {
      errors.push('Skill description is required');
    } else if (metadata.description.length < 10) {
      errors.push('Skill description must be at least 10 characters');
    } else if (metadata.description.length > 1024) {
      errors.push('Skill description must be 1024 characters or less');
    }

    // Version validation
    if (metadata.version && !this.isValidVersion(metadata.version)) {
      warnings.push('Version should follow semantic versioning (e.g., 1.0.0)');
    }
  }

  private async validateScripts(
    skill: ParsedSkill,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    for (const script of skill.resources.scripts) {
      // Check path traversal
      if (this.hasPathTraversal(script.path)) {
        errors.push(`Unsafe script path: ${script.path}`);
        continue;
      }

      // Check for dangerous code
      try {
        const content = await fs.readFile(script.fullPath, 'utf-8');
        const dangerousPatterns = this.scanForDangerousCode(content);
        
        if (dangerousPatterns.length > 0) {
          warnings.push(
            `Potentially dangerous code in ${script.path}: ${dangerousPatterns.join(', ')}`
          );
        }
      } catch (error) {
        logger.warn(`Could not read script for validation: ${script.path}`);
      }
    }
  }

  private validatePaths(skill: ParsedSkill, errors: string[]): void {
    const allFiles = [
      ...skill.resources.scripts,
      ...skill.resources.assets,
      ...skill.resources.references,
    ];

    for (const file of allFiles) {
      if (this.hasPathTraversal(file.path)) {
        errors.push(`Path traversal detected: ${file.path}`);
      }
      
      if (path.isAbsolute(file.path)) {
        errors.push(`Absolute path not allowed: ${file.path}`);
      }
    }
  }

  private hasPathTraversal(filePath: string): boolean {
    const normalized = path.normalize(filePath);
    return normalized.includes('..') || normalized.startsWith('/');
  }

  private isValidVersion(version: string): boolean {
    return /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(version);
  }

  private scanForDangerousCode(content: string): string[] {
    const found: string[] = [];
    
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(content)) {
        found.push(pattern.source.slice(0, 20) + '...');
      }
    }
    
    return found;
  }
}

export default SkillValidator;
