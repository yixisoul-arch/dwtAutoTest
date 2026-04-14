import path from 'node:path';
import type { ExecutionContext } from '../../context/execution_context.js';
import { buildVariableScope, extractByPath, resolveVariables } from '../../parser/variable_resolver.js';
import type { ExecutionPlan } from '../../model/execution_plan.js';
import type { StepDefinition, TestCaseDefinition } from '../../model/testcase.js';
import type { CaseExecutionResult, StepResult } from '../../model/result.js';
import { logger } from '../../common/logger.js';
import { StepRouter } from './step_router.js';
import type { WebEngine } from '../web/web_engine.js';

const NORMAL_PHASES = ['beforeActions', 'mainSteps', 'assertions'] as const;

type PhaseName = 'beforeActions' | 'mainSteps' | 'assertions' | 'afterActions';

const coerceError = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export class Executor {
  constructor(
    private readonly router: StepRouter,
    private readonly webEngine: WebEngine,
  ) {}

  public async execute(
    plan: ExecutionPlan,
    testCase: TestCaseDefinition,
    context: ExecutionContext,
  ): Promise<CaseExecutionResult> {
    const startedAt = new Date();
    const stepResults: StepResult[] = [];
    const errors: string[] = [];
    let hasFailed = false;

    for (const phase of NORMAL_PHASES) {
      const phaseSteps = plan.items.filter((item) => item.phase === phase);
      for (const item of phaseSteps) {
        if (hasFailed && (testCase.config?.stopOnFailure ?? true)) {
          stepResults.push(this.buildSkippedResult(item.step, phase));
          continue;
        }

        const result = await this.executeStep(item.step, phase, testCase, context);
        stepResults.push(result);
        if (result.status === 'failed') {
          hasFailed = true;
          errors.push(result.error ?? `${item.step.id} 执行失败`);
        }
      }
    }

    const cleanupSteps = plan.items.filter((item) => item.phase === 'afterActions');
    for (const item of cleanupSteps) {
      const result = await this.executeStep(item.step, 'afterActions', testCase, context);
      stepResults.push(result);
      if (result.status === 'failed') {
        errors.push(result.error ?? `${item.step.id} 清理失败`);
        hasFailed = true;
      }
    }

    const endedAt = new Date();
    return {
      caseId: plan.caseId,
      caseName: plan.caseName,
      status: hasFailed ? 'failed' : 'passed',
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMs: endedAt.getTime() - startedAt.getTime(),
      stepResults,
      errors,
    };
  }

  private async executeStep(
    step: StepDefinition,
    phase: PhaseName,
    testCase: TestCaseDefinition,
    context: ExecutionContext,
  ): Promise<StepResult> {
    const startedAt = new Date();

    try {
      await this.delayBeforeStep(testCase);
      const envDefaults = Object.fromEntries(
        Object.entries(process.env).filter(([, value]) => value !== undefined),
      ) as Record<string, unknown>;
      const scope = buildVariableScope(testCase.variables ?? {}, context.snapshot(), envDefaults);
      const resolvedParams = resolveVariables(step.params, scope);
      const resolvedStep: StepDefinition = { ...step, params: resolvedParams };
      logger.info(`执行步骤 ${step.id} - ${step.name}`);
      const output = await this.router.execute(resolvedStep, context);
      this.applyExtract(step, output, context);
      context.setLastStepOutput(output);

      const endedAt = new Date();
      return {
        stepId: step.id,
        stepName: step.name,
        type: step.type,
        phase,
        status: 'passed',
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        output,
      };
    } catch (error) {
      if (testCase.config?.screenshotOnFail) {
        try {
          const fileName = `${step.id}-failure.png`;
          const sessionName = typeof step.params.session === 'string' && step.params.session.length > 0 ? step.params.session : 'default';
          const screenshotPath = await this.webEngine.captureFailureScreenshot(fileName, sessionName);
          logger.warn('失败截图已保存', { stepId: step.id, screenshotPath: path.normalize(screenshotPath) });
        } catch (captureError) {
          logger.warn('保存失败截图时出错', { stepId: step.id, error: coerceError(captureError) });
        }
      }

      const endedAt = new Date();
      return {
        stepId: step.id,
        stepName: step.name,
        type: step.type,
        phase,
        status: 'failed',
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        error: coerceError(error),
      };
    }
  }

  protected async delayBeforeStep(testCase: TestCaseDefinition): Promise<void> {
    const delayMs = this.pickStepDelayMs(testCase);
    if (delayMs <= 0) {
      return;
    }

    await this.sleep(delayMs);
  }

  protected pickStepDelayMs(testCase: TestCaseDefinition): number {
    const stepDelayMs = testCase.config?.stepDelayMs;
    if (!stepDelayMs) {
      return 0;
    }

    if (stepDelayMs.min === stepDelayMs.max) {
      return stepDelayMs.min;
    }

    return Math.floor(Math.random() * (stepDelayMs.max - stepDelayMs.min + 1)) + stepDelayMs.min;
  }

  protected async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private applyExtract(step: StepDefinition, output: unknown, context: ExecutionContext): void {
    if (!step.extract) {
      return;
    }

    const extractionSource =
      step.type.startsWith('api_') && output && typeof output === 'object' && 'body' in (output as Record<string, unknown>)
        ? (output as { body: unknown }).body
        : output;

    const extracted = Object.fromEntries(
      Object.entries(step.extract).map(([key, expression]) => [key, extractByPath(extractionSource, expression)]),
    );
    context.merge(extracted);
  }

  private buildSkippedResult(step: StepDefinition, phase: PhaseName): StepResult {
    const timestamp = new Date().toISOString();
    return {
      stepId: step.id,
      stepName: step.name,
      type: step.type,
      phase,
      status: 'skipped',
      startedAt: timestamp,
      endedAt: timestamp,
      durationMs: 0,
      error: '已因 stopOnFailure 跳过',
    };
  }
}
