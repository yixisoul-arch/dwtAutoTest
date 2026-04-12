import { createExecutionContext } from '../context/execution_context.js';
import { ApiEngine } from '../engine/api/api_engine.js';
import { DbEngine } from '../engine/db/db_engine.js';
import { buildExecutionPlan } from '../engine/orchestration/plan_builder.js';
import { Executor } from '../engine/orchestration/executor.js';
import { StepRouter } from '../engine/orchestration/step_router.js';
import { WebEngine } from '../engine/web/web_engine.js';
import { templateLoader } from '../parser/template_loader.js';
import { validateTemplate } from '../validator/template_validator.js';
import { buildReport } from '../report/report_builder.js';
import type { AppConfig } from '../model/config.js';
import type { ReportModel } from '../model/report_model.js';

export const runCase = async (templatePath: string, config: AppConfig): Promise<ReportModel> => {
  const loaded = await templateLoader(templatePath);
  validateTemplate(loaded.definition);

  const context = createExecutionContext(loaded.definition);
  const webEngine = new WebEngine(config.web);
  const apiEngine = new ApiEngine(config.api);
  const dbEngine = new DbEngine(config.db);
  const router = new StepRouter(webEngine, apiEngine, dbEngine);
  const executor = new Executor(router, webEngine);

  try {
    const plan = buildExecutionPlan(loaded.definition);
    const result = await executor.execute(plan, loaded.definition, context);
    return await buildReport(result, config.report);
  } finally {
    await webEngine.close();
    await dbEngine.close();
  }
};
