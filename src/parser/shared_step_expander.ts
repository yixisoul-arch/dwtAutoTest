import type { RawTestCaseDefinition, SharedStepReference, SharedStepTemplate, StepDefinition, StepPhase, TestCaseDefinition } from '../model/testcase.js';
import { isSharedStepReference } from '../model/testcase.js';
import { ValidationError } from '../common/errors.js';
import { SharedStepLoader } from './shared_step_loader.js';

const PHASES: StepPhase[] = ['beforeActions', 'mainSteps', 'assertions', 'afterActions'];
const PARAM_PATTERN = /\$\{([^}]+)\}/g;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const cloneStep = (step: StepDefinition): StepDefinition => ({
  ...step,
  params: structuredClone(step.params),
  extract: step.extract ? { ...step.extract } : undefined,
});

const sanitizeId = (value: string): string => value.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

const applyParamBindings = <T>(value: T, bindings: Record<string, unknown>, declaredParams: Set<string>): T => {
  if (typeof value === 'string') {
    return value.replace(PARAM_PATTERN, (_, expression: string) => {
      const trimmed = expression.trim();
      if (trimmed.startsWith('context.') || !declaredParams.has(trimmed)) {
        return `\${${trimmed}}`;
      }

      if (!(trimmed in bindings)) {
        throw new ValidationError(`共享步骤参数缺失: ${trimmed}`);
      }

      return String(bindings[trimmed]);
    }) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => applyParamBindings(item, bindings, declaredParams)) as T;
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, applyParamBindings(nested, bindings, declaredParams)]),
    ) as T;
  }

  return value;
};

const buildBindings = (reference: SharedStepReference, template: SharedStepTemplate): Record<string, unknown> => {
  const definitions = template.params ?? {};
  const provided = reference.with ?? {};

  Object.keys(provided).forEach((key) => {
    if (!(key in definitions)) {
      throw new ValidationError(`共享步骤参数未声明: ${template.sharedId}.${key}`);
    }
  });

  return Object.fromEntries(
    Object.entries(definitions).map(([key, definition]) => {
      if (key in provided) {
        return [key, provided[key]];
      }
      if ('default' in definition) {
        return [key, definition.default];
      }
      if (definition.required) {
        throw new ValidationError(`共享步骤参数缺失: ${template.sharedId}.${key}`);
      }
      return [key, undefined];
    }),
  );
};

interface ExpansionState {
  counts: Map<string, number>;
  stack: string[];
}

const expandPhaseItems = async (
  phase: StepPhase,
  items: Array<StepDefinition | SharedStepReference>,
  loader: SharedStepLoader,
  state: ExpansionState,
): Promise<StepDefinition[]> => {
  const expanded: StepDefinition[] = [];

  for (const item of items) {
    if (!isSharedStepReference(item)) {
      expanded.push(cloneStep(item));
      continue;
    }

    if (item.enabled === false) {
      continue;
    }

    if (state.stack.includes(item.use)) {
      throw new ValidationError(`共享步骤循环引用: ${[...state.stack, item.use].join(' -> ')}`);
    }

    const template = await loader.load(item.use);
    const templateItems = template.phases[phase] ?? [];
    const nextState: ExpansionState = {
      counts: state.counts,
      stack: [...state.stack, item.use],
    };

    const nested = await expandPhaseItems(phase, templateItems, loader, nextState);
    const occurrence = (state.counts.get(`${phase}:${item.use}`) ?? 0) + 1;
    state.counts.set(`${phase}:${item.use}`, occurrence);

    const prefix = item.idPrefix?.trim() || `${phase}__${sanitizeId(item.use)}__${occurrence}`;
    const bindings = buildBindings(item, template);
    const declaredParams = new Set(Object.keys(template.params ?? {}));

    nested.forEach((step) => {
      expanded.push({
        ...step,
        id: `${prefix}__${step.id}`,
        params: applyParamBindings(step.params, bindings, declaredParams),
        extract: step.extract ? applyParamBindings(step.extract, bindings, declaredParams) : undefined,
      });
    });
  }

  return expanded;
};

export const expandSharedSteps = async (testCase: RawTestCaseDefinition): Promise<TestCaseDefinition> => {
  const loader = new SharedStepLoader();
  const state: ExpansionState = { counts: new Map(), stack: [] };

  const expandedPhases = await Promise.all(
    PHASES.map(async (phase) => [phase, await expandPhaseItems(phase, testCase[phase] ?? [], loader, state)] as const),
  );

  return {
    ...testCase,
    beforeActions: expandedPhases.find(([phase]) => phase === 'beforeActions')?.[1] ?? [],
    mainSteps: expandedPhases.find(([phase]) => phase === 'mainSteps')?.[1] ?? [],
    assertions: expandedPhases.find(([phase]) => phase === 'assertions')?.[1] ?? [],
    afterActions: expandedPhases.find(([phase]) => phase === 'afterActions')?.[1] ?? [],
  };
};
