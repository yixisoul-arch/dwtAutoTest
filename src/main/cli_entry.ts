import { loadAppConfig } from './bootstrap.js';
import { runCase } from './app.js';
import { logger } from '../common/logger.js';

const main = async (): Promise<void> => {
  const templatePath = process.argv[2];

  if (!templatePath) {
    throw new Error('请提供模板路径，例如: npm start -- cases/scenario/login.yaml');
  }

  const config = await loadAppConfig();
  const report = await runCase(templatePath, config);
  logger.info('执行完成', report.artifacts);
};

main().catch((error) => {
  logger.error('执行失败', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
