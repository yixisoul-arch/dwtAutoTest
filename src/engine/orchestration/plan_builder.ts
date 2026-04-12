import type { TestCaseDefinition, StepDefinition } from '../../model/testcase.js';
import type { ExecutionPlan } from '../../model/execution_plan.js';
import type { StepExecutionItem } from '../../model/step.js';

const PHASES: Array<keyof Pick<TestCaseDefinition, 'beforeActions' | 'mainSteps' | 'assertions' | 'afterActions'>> = [
  'beforeActions',
  'mainSteps',
  'assertions',
  'afterActions',
];

export const buildExecutionPlan = (testCase: TestCaseDefinition): ExecutionPlan => {
  const items: StepExecutionItem[] = [];

  PHASES.forEach((phase) => {
    (testCase[phase] ?? []).forEach((step: StepDefinition) => {
      if (step.enabled === false) {
        return;
      }

      items.push({ phase, step });
    });
  });

  return {
    caseId: testCase.caseId,
    caseName: testCase.caseName,
    items,
  };
};
