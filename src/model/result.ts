export type StepStatus = 'passed' | 'failed' | 'skipped';

export interface StepResult {
  stepId: string;
  stepName: string;
  type: string;
  phase: 'beforeActions' | 'mainSteps' | 'assertions' | 'afterActions';
  status: StepStatus;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  error?: string;
  output?: unknown;
}

export interface CaseExecutionResult {
  caseId: string;
  caseName: string;
  status: 'passed' | 'failed';
  startedAt: string;
  endedAt: string;
  durationMs: number;
  stepResults: StepResult[];
  errors: string[];
}
