import type { TestCaseDefinition } from '../model/testcase.js';
import type { StepDefinition } from '../model/testcase.js';
import { SUPPORTED_STEP_TYPES } from '../common/constants.js';
import { ValidationError } from '../common/errors.js';
import { validateSqlSafety } from './sql_validator.js';

const PHASES: Array<keyof Pick<TestCaseDefinition, 'beforeActions' | 'mainSteps' | 'assertions' | 'afterActions'>> = [
  'beforeActions',
  'mainSteps',
  'assertions',
  'afterActions',
];

const VARIABLE_PATTERN = /\$\{([^}]+)\}/g;

const validateStepDelayConfig = (testCase: TestCaseDefinition) => {
  const stepDelayMs = testCase.config?.stepDelayMs;
  if (stepDelayMs === undefined) {
    return;
  }

  if (
    stepDelayMs === null ||
    typeof stepDelayMs !== 'object' ||
    Array.isArray(stepDelayMs) ||
    typeof stepDelayMs.min !== 'number' ||
    Number.isNaN(stepDelayMs.min) ||
    typeof stepDelayMs.max !== 'number' ||
    Number.isNaN(stepDelayMs.max)
  ) {
    throw new ValidationError('stepDelayMs 配置无效，必须提供数值类型的 min 和 max');
  }

  if (stepDelayMs.min < 0 || stepDelayMs.max < 0) {
    throw new ValidationError('stepDelayMs 配置无效，min 和 max 不能小于 0');
  }

  if (stepDelayMs.max < stepDelayMs.min) {
    throw new ValidationError('stepDelayMs 配置无效，max 不能小于 min');
  }
};

const validateStep = (step: StepDefinition, phase: string) => {
  if (!step.id || !step.type || !step.name || !step.params) {
    throw new ValidationError(`步骤缺少必填字段: ${phase}/${step.id || 'unknown'}`);
  }

  const session = step.params.session;
  if (session !== undefined && (typeof session !== 'string' || session.length === 0)) {
    throw new ValidationError(`步骤 session 配置无效: ${step.id}`);
  }

  const site = step.params.site;
  if (site !== undefined && (typeof site !== 'string' || site.length === 0)) {
    throw new ValidationError(`步骤 site 配置无效: ${step.id}`);
  }

  if (!SUPPORTED_STEP_TYPES.has(step.type)) {
    throw new ValidationError(`不支持的步骤类型: ${step.type}`);
  }

  if (step.type.startsWith('db_')) {
    const sql = step.params.sql;
    if (typeof sql !== 'string' || sql.trim().length === 0) {
      throw new ValidationError(`数据库步骤缺少 sql: ${step.id}`);
    }
    validateSqlSafety(sql);
  }
};

const collectContextNeeds = (step: StepDefinition, refs: Set<string>) => {
  const serialized = JSON.stringify(step);
  const matches = serialized.matchAll(VARIABLE_PATTERN);
  for (const match of matches) {
    const expression = match[1]?.trim();
    if (expression?.startsWith('context.')) {
      refs.add(expression.slice('context.'.length));
    }
  }
};

const collectProducedContext = (steps: StepDefinition[]): Set<string> => {
  const produced = new Set<string>();
  for (const step of steps) {
    if (!step.extract) continue;
    Object.keys(step.extract).forEach((key) => produced.add(key));
  }
  return produced;
};

const validateUniqueStepIds = (steps: StepDefinition[]) => {
  const seen = new Set<string>();

  steps.forEach((step) => {
    if (seen.has(step.id)) {
      throw new ValidationError(`步骤 ID 重复: ${step.id}`);
    }
    seen.add(step.id);
  });
};

export const validateTemplate = (testCase: TestCaseDefinition): void => {
  if (!testCase.caseId || !testCase.caseName || !testCase.description || !testCase.mode) {
    throw new ValidationError('模板缺少必填顶层字段');
  }

  if (!Array.isArray(testCase.mainSteps) || testCase.mainSteps.length === 0) {
    throw new ValidationError('mainSteps 不能为空');
  }

  validateStepDelayConfig(testCase);

  const allSteps: StepDefinition[] = [];
  PHASES.forEach((phase) => {
    const steps = testCase[phase] ?? [];
    steps.forEach((step) => {
      validateStep(step, phase);
      allSteps.push(step);
    });
  });

  const neededContext = new Set<string>();
  allSteps.forEach((step) => collectContextNeeds(step, neededContext));
  validateUniqueStepIds(allSteps);

  const producedContext = collectProducedContext(allSteps);
  const initialVariables = new Set(Object.keys(testCase.variables ?? {}));

  neededContext.forEach((key) => {
    if (!producedContext.has(key) && !initialVariables.has(key)) {
      throw new ValidationError(`缺少上下文变量来源: context.${key}`);
    }
  });
};
