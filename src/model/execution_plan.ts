import type { StepExecutionItem } from './step.js';

export interface ExecutionPlan {
  caseId: string;
  caseName: string;
  items: StepExecutionItem[];
}
