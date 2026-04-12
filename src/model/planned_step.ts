import type { StepDefinition, StepPhase } from './testcase.js';

export interface PlannedStep {
  phase: StepPhase;
  step: StepDefinition;
}
