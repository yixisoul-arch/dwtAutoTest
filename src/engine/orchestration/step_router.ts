import type { StepDefinition } from '../../model/testcase.js';
import type { ExecutionContext } from '../../context/execution_context.js';
import type { WebEngine } from '../web/web_engine.js';
import type { ApiEngine } from '../api/api_engine.js';
import type { DbEngine } from '../db/db_engine.js';
import { ExecutionError } from '../../common/errors.js';

export class StepRouter {
  constructor(
    private readonly webEngine: WebEngine,
    private readonly apiEngine: ApiEngine,
    private readonly dbEngine: DbEngine,
  ) {}

  public async execute(step: StepDefinition, context: ExecutionContext): Promise<unknown> {
    if (step.type.startsWith('web_')) {
      return this.webEngine.execute(step, context);
    }

    if (step.type.startsWith('api_')) {
      return this.apiEngine.execute(step, context);
    }

    if (step.type.startsWith('db_')) {
      return this.dbEngine.execute(step, context);
    }

    throw new ExecutionError(`找不到步骤路由: ${step.type}`);
  }
}
