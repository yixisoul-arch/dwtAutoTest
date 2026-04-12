export type StepPhase = 'beforeActions' | 'mainSteps' | 'assertions' | 'afterActions';

export interface StepDefinition {
  id: string;
  type: string;
  name: string;
  enabled?: boolean;
  params: Record<string, unknown>;
  extract?: Record<string, string>;
}

export interface SharedStepReference {
  use: string;
  with?: Record<string, unknown>;
  enabled?: boolean;
  idPrefix?: string;
}

export interface SharedStepParamDefinition {
  required?: boolean;
  default?: unknown;
}

export type PhaseItem = StepDefinition | SharedStepReference;

export interface TestCaseConfig {
  retryCount?: number;
  timeout?: number;
  screenshotOnFail?: boolean;
  stopOnFailure?: boolean;
}

export interface RawTestCaseDefinition {
  caseId: string;
  caseName: string;
  description: string;
  tags?: string[];
  priority?: string;
  mode: 'web' | 'api' | 'hybrid';
  config?: TestCaseConfig;
  variables?: Record<string, unknown>;
  beforeActions?: PhaseItem[];
  mainSteps: PhaseItem[];
  assertions?: PhaseItem[];
  afterActions?: PhaseItem[];
}

export interface TestCaseDefinition {
  caseId: string;
  caseName: string;
  description: string;
  tags?: string[];
  priority?: string;
  mode: 'web' | 'api' | 'hybrid';
  config?: TestCaseConfig;
  variables?: Record<string, unknown>;
  beforeActions?: StepDefinition[];
  mainSteps: StepDefinition[];
  assertions?: StepDefinition[];
  afterActions?: StepDefinition[];
}

export interface SharedStepTemplate {
  sharedId: string;
  description?: string;
  params?: Record<string, SharedStepParamDefinition>;
  phases: Partial<Record<StepPhase, PhaseItem[]>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const isSharedStepReference = (value: unknown): value is SharedStepReference =>
  isRecord(value) && typeof value.use === 'string';
