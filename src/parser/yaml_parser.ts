import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { ValidationError } from '../common/errors.js';
import type { RawTestCaseDefinition, SharedStepTemplate } from '../model/testcase.js';

const ENV_PATTERN = /\$\{([A-Z0-9_]+)\}/g;

const replaceEnvPlaceholders = (raw: string): string =>
  raw.replace(ENV_PATTERN, (_, key: string) => process.env[key] ?? `\${${key}}`);

const parseYamlDocument = <T>(raw: string): T => {
  const parsed = yaml.load(replaceEnvPlaceholders(raw));

  if (!parsed || typeof parsed !== 'object') {
    throw new ValidationError('YAML 模板内容无效');
  }

  return parsed as T;
};

export const parseYamlTemplate = (raw: string): RawTestCaseDefinition => parseYamlDocument<RawTestCaseDefinition>(raw);

export const parseSharedStepTemplate = (raw: string): SharedStepTemplate => parseYamlDocument<SharedStepTemplate>(raw);

export const loadYamlDocumentFile = async <T>(filePath: string): Promise<T> => {
  const absolutePath = path.resolve(filePath);
  const raw = await fs.readFile(absolutePath, 'utf-8');
  return parseYamlDocument<T>(raw);
};

export const loadTemplateFile = async (filePath: string): Promise<RawTestCaseDefinition> =>
  loadYamlDocumentFile<RawTestCaseDefinition>(filePath);

export const loadSharedStepFile = async (filePath: string): Promise<SharedStepTemplate> =>
  loadYamlDocumentFile<SharedStepTemplate>(filePath);
