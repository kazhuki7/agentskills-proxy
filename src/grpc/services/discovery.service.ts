import * as grpc from '@grpc/grpc-js';
import { SkillRegistry } from '../../core/skill-manager/registry';
import { ProgressiveLoadManager } from '../../core/progressive-loader/level-manager';
import { LoadLevel, SkillMetadata, FileReference } from '../../models/skill.model';
import logger from '../../utils/logger';

function convertMetadataToProto(metadata: SkillMetadata): any {
  return {
    id: metadata.id,
    name: metadata.name,
    description: metadata.description,
    version: metadata.version,
    tags: metadata.tags,
    author: metadata.author,
    created_at: metadata.createdAt.toString(),
    updated_at: metadata.updatedAt.toString(),
    license: metadata.license,
  };
}

export function createDiscoveryService(
  registry: SkillRegistry,
  progressiveLoader: ProgressiveLoadManager
): any {
  return {
    ListSkills: (
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) => {
      try {
        const { page = 1, page_size = 20, tags = [] } = call.request;
        
        let skills = registry.getAllMetadata();
        
        // Filter by tags
        if (tags && tags.length > 0) {
          skills = skills.filter((skill) =>
            tags.some((tag: string) => skill.tags.includes(tag))
          );
        }
        
        // Paginate
        const start = (page - 1) * page_size;
        const paginatedSkills = skills.slice(start, start + page_size);
        
        callback(null, {
          skills: paginatedSkills.map(convertMetadataToProto),
          total: skills.length,
          status: { code: 0, message: 'Success' },
        });
      } catch (error: any) {
        logger.error('ListSkills error:', error);
        callback(null, {
          skills: [],
          total: 0,
          status: { code: 1, message: error.message },
        });
      }
    },

    SearchSkills: (
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) => {
      try {
        const { query = '', tags = [], limit = 10 } = call.request;
        
        const skills = registry.searchSkills(query, tags).slice(0, limit);
        
        callback(null, {
          skills: skills.map(convertMetadataToProto),
          status: { code: 0, message: 'Success' },
        });
      } catch (error: any) {
        logger.error('SearchSkills error:', error);
        callback(null, {
          skills: [],
          status: { code: 1, message: error.message },
        });
      }
    },

    GetSkillDetails: async (
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) => {
      try {
        const { skill_id, level = 'METADATA_ONLY' } = call.request;
        
        const loadLevel = parseLoadLevel(level);
        const skillData = await progressiveLoader.loadSkill(skill_id, loadLevel);
        
        if (!skillData) {
          callback(null, {
            status: { code: 2, message: 'Skill not found' },
          });
          return;
        }
        
        const response: any = {
          metadata: convertMetadataToProto(skillData.metadata),
          status: { code: 0, message: 'Success' },
        };
        
        if (skillData.instructions) {
          response.instructions = {
            markdown_content: skillData.instructions.markdownContent,
            allowed_tools: skillData.instructions.allowedTools,
            parameters: skillData.instructions.parameters,
            examples: skillData.instructions.examples,
          };
        }
        
        if (skillData.resources) {
          response.resources = {
            scripts: skillData.resources.scripts.map((f: FileReference) => ({
              path: f.path,
              type: f.type,
              size: f.size.toString(),
              checksum: f.checksum,
            })),
            assets: skillData.resources.assets.map((f: FileReference) => ({
              path: f.path,
              type: f.type,
              size: f.size.toString(),
              checksum: f.checksum,
            })),
            references: skillData.resources.references.map((f: FileReference) => ({
              path: f.path,
              type: f.type,
              size: f.size.toString(),
              checksum: f.checksum,
            })),
            download_base_url: skillData.resources.downloadBaseUrl,
          };
        }
        
        callback(null, response);
      } catch (error: any) {
        logger.error('GetSkillDetails error:', error);
        callback(null, {
          status: { code: 1, message: error.message },
        });
      }
    },

    WatchSkills: (call: grpc.ServerWritableStream<any, any>) => {
      const { skill_ids = [] } = call.request;
      
      const callback = (event: any) => {
        // Filter by skill_ids if specified
        if (skill_ids.length > 0 && !skill_ids.includes(event.skillId)) {
          return;
        }
        
        const protoEvent = {
          type: event.type,
          skill: event.skill ? convertMetadataToProto(event.skill) : null,
          timestamp: Date.now().toString(),
        };
        
        call.write(protoEvent);
      };
      
      registry.onSkillChange(callback);
      
      call.on('cancelled', () => {
        registry.removeChangeCallback(callback);
        logger.debug('WatchSkills stream cancelled');
      });
      
      call.on('error', (error) => {
        registry.removeChangeCallback(callback);
        logger.error('WatchSkills stream error:', error);
      });
    },
  };
}

function parseLoadLevel(level: string): LoadLevel {
  switch (level) {
    case 'WITH_INSTRUCTIONS':
    case '1':
      return LoadLevel.WITH_INSTRUCTIONS;
    case 'FULL_RESOURCES':
    case '2':
      return LoadLevel.FULL_RESOURCES;
    case 'METADATA_ONLY':
    case '0':
    default:
      return LoadLevel.METADATA_ONLY;
  }
}
