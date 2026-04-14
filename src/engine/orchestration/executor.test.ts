import test from 'node:test';
import assert from 'node:assert/strict';
import { ExecutionContext } from '../../context/execution_context.js';
import type { ExecutionPlan } from '../../model/execution_plan.js';
import type { TestCaseDefinition } from '../../model/testcase.js';
import type { StepDefinition } from '../../model/testcase.js';
import { ExecutionError } from '../../common/errors.js';
import { Executor } from './executor.js';

const createStep = (id: string, type = 'db_query'): StepDefinition => ({
  id,
  type,
  name: id,
  params: {
    sql: `SELECT '${id}' AS value`,
  },
});

const createCase = (): TestCaseDefinition => ({
  caseId: 'TC_EXECUTOR_DELAY_001',
  caseName: 'executor delay',
  description: 'executor delay tests',
  mode: 'hybrid',
  config: {},
  mainSteps: [createStep('step_1')],
});

const createPlan = (steps: Array<{ phase: 'beforeActions' | 'mainSteps' | 'assertions' | 'afterActions'; step: StepDefinition }>): ExecutionPlan => ({
  caseId: 'TC_EXECUTOR_DELAY_001',
  caseName: 'executor delay',
  items: steps,
});

test('executor delays before each executed step', async () => {
  const events: string[] = [];
  const router = {
    execute: async (step: StepDefinition) => {
      events.push(`execute:${step.id}`);
      return { ok: true };
    },
  } as never;
  const webEngine = {
    captureFailureScreenshot: async () => 'unused.png',
  } as never;
  const executor = new Executor(router, webEngine) as Executor & {
    sleep: (ms: number) => Promise<void>;
    pickStepDelayMs: (testCase: TestCaseDefinition) => number;
  };

  executor.pickStepDelayMs = () => 3000;
  executor.sleep = async (ms: number) => {
    events.push(`sleep:${ms}`);
  };

  const testCase = createCase();
  testCase.config = {
    stepDelayMs: { min: 3000, max: 5000 },
  };
  const plan = createPlan([{ phase: 'mainSteps', step: createStep('step_1') }]);

  const result = await executor.execute(plan, testCase, new ExecutionContext());

  assert.equal(result.status, 'passed');
  assert.deepEqual(events, ['sleep:3000', 'execute:step_1']);
});

test('executor does not delay skipped steps after failure', async () => {
  const events: string[] = [];
  const router = {
    execute: async (step: StepDefinition) => {
      events.push(`execute:${step.id}`);
      if (step.id === 'step_1') {
        throw new ExecutionError('boom');
      }
      return { ok: true };
    },
  } as never;
  const webEngine = {
    captureFailureScreenshot: async () => 'failure.png',
  } as never;
  const executor = new Executor(router, webEngine) as Executor & {
    sleep: (ms: number) => Promise<void>;
    pickStepDelayMs: (testCase: TestCaseDefinition) => number;
  };

  executor.pickStepDelayMs = () => 3000;
  executor.sleep = async (ms: number) => {
    events.push(`sleep:${ms}`);
  };

  const testCase: TestCaseDefinition = {
    ...createCase(),
    config: {
      stopOnFailure: true,
      screenshotOnFail: true,
      stepDelayMs: { min: 3000, max: 5000 },
    },
    mainSteps: [createStep('step_1'), createStep('step_2')],
  };
  const plan = createPlan([
    { phase: 'mainSteps', step: createStep('step_1') },
    { phase: 'mainSteps', step: createStep('step_2') },
  ]);

  const result = await executor.execute(plan, testCase, new ExecutionContext());

  assert.equal(result.status, 'failed');
  assert.deepEqual(events, ['sleep:3000', 'execute:step_1']);
  assert.equal(result.stepResults[1]?.status, 'skipped');
  assert.equal(result.stepResults[1]?.durationMs, 0);
});

test('executor delays executed afterActions even after earlier failure', async () => {
  const events: string[] = [];
  const router = {
    execute: async (step: StepDefinition) => {
      events.push(`execute:${step.id}`);
      if (step.id === 'step_1') {
        throw new ExecutionError('boom');
      }
      return { ok: true };
    },
  } as never;
  const webEngine = {
    captureFailureScreenshot: async () => 'failure.png',
  } as never;
  const executor = new Executor(router, webEngine) as Executor & {
    sleep: (ms: number) => Promise<void>;
    pickStepDelayMs: (testCase: TestCaseDefinition) => number;
  };

  executor.pickStepDelayMs = () => 3000;
  executor.sleep = async (ms: number) => {
    events.push(`sleep:${ms}`);
  };

  const testCase: TestCaseDefinition = {
    ...createCase(),
    config: {
      stopOnFailure: true,
      screenshotOnFail: true,
      stepDelayMs: { min: 3000, max: 5000 },
    },
    mainSteps: [createStep('step_1')],
    afterActions: [createStep('cleanup')],
  };
  const plan = createPlan([
    { phase: 'mainSteps', step: createStep('step_1') },
    { phase: 'afterActions', step: createStep('cleanup') },
  ]);

  const result = await executor.execute(plan, testCase, new ExecutionContext());

  assert.equal(result.status, 'failed');
  assert.deepEqual(events, ['sleep:3000', 'execute:step_1', 'sleep:3000', 'execute:cleanup']);
  assert.equal(result.stepResults[1]?.status, 'passed');
});

test('executor captures failure screenshot without extra post-failure delay', async () => {
  const events: string[] = [];
  const router = {
    execute: async (step: StepDefinition) => {
      events.push(`execute:${step.id}`);
      throw new ExecutionError('boom');
    },
  } as never;
  const webEngine = {
    captureFailureScreenshot: async (fileName: string, sessionName: string) => {
      events.push(`screenshot:${sessionName}:${fileName}`);
      return 'failure.png';
    },
  } as never;
  const executor = new Executor(router, webEngine) as Executor & {
    sleep: (ms: number) => Promise<void>;
    pickStepDelayMs: (testCase: TestCaseDefinition) => number;
  };

  executor.pickStepDelayMs = () => 3000;
  executor.sleep = async (ms: number) => {
    events.push(`sleep:${ms}`);
  };

  const failingStep = createStep('step_1', 'web_click');
  failingStep.params = { session: 'admin' };
  const testCase: TestCaseDefinition = {
    ...createCase(),
    config: {
      screenshotOnFail: true,
      stepDelayMs: { min: 3000, max: 5000 },
    },
    mainSteps: [failingStep],
  };
  const plan = createPlan([{ phase: 'mainSteps', step: failingStep }]);

  const result = await executor.execute(plan, testCase, new ExecutionContext());

  assert.equal(result.status, 'failed');
  assert.deepEqual(events, ['sleep:3000', 'execute:step_1', 'screenshot:admin:step_1-failure.png']);
});
