import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { ValidationError } from './errors.js';

const ENV_PATTERN = /\$\{([A-Z0-9_]+)\}/g;

const replaceEnv = (raw: string): string =>
  raw.replace(ENV_PATTERN, (_, key: string) => process.env[key] ?? `\${${key}}`);

export const loadYamlWithEnv = async <T>(filePath: string): Promise<T> => {
  const absolutePath = path.resolve(filePath);
  const raw = await fs.readFile(absolutePath, 'utf-8');
  const parsed = yaml.load(replaceEnv(raw));

  if (parsed === undefined) {
    throw new ValidationError(`无法解析配置文件: ${absolutePath}`);
  }

  return parsed as T;
};
