import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { parse as parseYaml } from 'yaml';
import {
  ParsedSkill,
  SkillMetadata,
  SkillInstructions,
  SkillResources,
  SkillFrontmatter,
  FileReference,
} from '../../models/skill.model';
import logger from '../../utils/logger';

export class SkillParser {
  async parseSkillFile(filePath: string): Promise<ParsedSkill> {
    const content = await fs.readFile(filePath, 'utf-8');
    const basePath = path.dirname(filePath);
    
    const { frontmatter, body } = this.separateFrontmatter(content);
    const parsedFrontmatter = parseYaml(frontmatter) as SkillFrontmatter;
    
    const metadata = this.normalizeMetadata(parsedFrontmatter, basePath);
    const instructions = this.parseInstructions(parsedFrontmatter, body);
    const resources = await this.scanResources(basePath);

    return {
      metadata,
      instructions,
      resources,
      basePath,
    };
  }

  async parseMetadataOnly(filePath: string): Promise<SkillMetadata> {
    const content = await fs.readFile(filePath, 'utf-8');
    const basePath = path.dirname(filePath);
    
    const { frontmatter } = this.separateFrontmatter(content);
    const parsedFrontmatter = parseYaml(frontmatter) as SkillFrontmatter;
    
    return this.normalizeMetadata(parsedFrontmatter, basePath);
  }

  private separateFrontmatter(content: string): { frontmatter: string; body: string } {
    const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) {
      throw new Error('Invalid SKILL.md format: missing YAML frontmatter');
    }
    return {
      frontmatter: match[1],
      body: match[2],
    };
  }

  private normalizeMetadata(frontmatter: SkillFrontmatter, basePath: string): SkillMetadata {
    const skillId = path.basename(basePath);
    const now = Date.now();
    
    return {
      id: skillId,
      name: frontmatter.name || skillId,
      description: frontmatter.description || '',
      version: frontmatter.version || '1.0.0',
      tags: frontmatter.tags || [],
      author: frontmatter.author || '',
      license: frontmatter.license || 'MIT',
      allowedTools: frontmatter['allowed-tools'] || [],
      createdAt: now,
      updatedAt: now,
    };
  }

  private parseInstructions(frontmatter: SkillFrontmatter, body: string): SkillInstructions {
    const examples = this.extractExamples(body);
    
    return {
      markdownContent: body,
      allowedTools: frontmatter['allowed-tools'] || [],
      parameters: frontmatter.parameters || {},
      examples,
    };
  }

  private extractExamples(body: string): string[] {
    const examples: string[] = [];
    const exampleRegex = /```[\s\S]*?```/g;
    let match;
    
    while ((match = exampleRegex.exec(body)) !== null) {
      examples.push(match[0]);
    }
    
    return examples;
  }

  async scanResources(skillDir: string): Promise<SkillResources> {
    const resources: SkillResources = {
      scripts: [],
      assets: [],
      references: [],
    };

    const scriptsDir = path.join(skillDir, 'scripts');
    if (await this.dirExists(scriptsDir)) {
      resources.scripts = await this.scanDirectory(scriptsDir, skillDir);
    }

    const assetsDir = path.join(skillDir, 'assets');
    if (await this.dirExists(assetsDir)) {
      resources.assets = await this.scanDirectory(assetsDir, skillDir);
    }

    const referencesDir = path.join(skillDir, 'references');
    if (await this.dirExists(referencesDir)) {
      resources.references = await this.scanDirectory(referencesDir, skillDir);
    }

    return resources;
  }

  private async scanDirectory(dir: string, baseDir: string): Promise<FileReference[]> {
    const files: FileReference[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isFile()) {
          const stat = await fs.stat(fullPath);
          const content = await fs.readFile(fullPath);
          const checksum = crypto.createHash('sha256').update(content).digest('hex');
          
          files.push({
            path: path.relative(baseDir, fullPath),
            type: this.getFileType(entry.name),
            size: stat.size,
            checksum,
            fullPath,
          });
        } else if (entry.isDirectory()) {
          const subFiles = await this.scanDirectory(fullPath, baseDir);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      logger.error(`Error scanning directory ${dir}:`, error);
    }
    
    return files;
  }

  private getFileType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const typeMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.sh': 'shell',
      '.bash': 'shell',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    };
    return typeMap[ext] || 'application/octet-stream';
  }

  private async dirExists(dir: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dir);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}

export default SkillParser;
