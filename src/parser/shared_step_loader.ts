import path from 'node:path';
import { resolveFromCwd } from '../common/file_utils.js';
import { ValidationError } from '../common/errors.js';
import type { SharedStepTemplate } from '../model/testcase.js';
import { loadSharedStepFile } from './yaml_parser.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const validateSharedTemplate = (template: SharedStepTemplate, expectedSharedId: string): SharedStepTemplate => {
  if (!template.sharedId || template.sharedId !== expectedSharedId) {
    throw new ValidationError(`共享步骤 sharedId 不匹配: 期望 ${expectedSharedId}，实际 ${template.sharedId || 'empty'}`);
  }

  if (!isRecord(template.phases)) {
    throw new ValidationError(`共享步骤缺少 phases: ${expectedSharedId}`);
  }

  return template;
};

export class SharedStepLoader {
  private readonly cache = new Map<string, SharedStepTemplate>();

  public async load(sharedId: string): Promise<SharedStepTemplate> {
    if (this.cache.has(sharedId)) {
      return this.cache.get(sharedId)!;
    }

    const filePath = resolveFromCwd('cases', 'shared', ...sharedId.split('/')) + '.yaml';

    try {
      const template = validateSharedTemplate(await loadSharedStepFile(filePath), sharedId);
      this.cache.set(sharedId, template);
      return template;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        throw new ValidationError(`共享步骤不存在: ${sharedId} (${path.normalize(filePath)})`);
      }
      throw error;
    }
  }
}
