import 'dotenv/config';
import type { AppConfig } from '../model/config.js';
import { loadYamlWithEnv } from '../common/yaml.js';
import { resolveFromCwd } from '../common/file_utils.js';

export const loadAppConfig = async (): Promise<AppConfig> => ({
  system: await loadYamlWithEnv(resolveFromCwd('config/system.yaml')),
  web: await loadYamlWithEnv(resolveFromCwd('config/web.yaml')),
  api: await loadYamlWithEnv(resolveFromCwd('config/api.yaml')),
  db: await loadYamlWithEnv(resolveFromCwd('config/db.yaml')),
  report: await loadYamlWithEnv(resolveFromCwd('config/report.yaml')),
});
