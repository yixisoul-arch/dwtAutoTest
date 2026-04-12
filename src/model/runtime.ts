import type { TestCaseConfig, TestCaseDefinition } from './testcase.js';

export interface StepExecutionContext {
  caseConfig: TestCaseConfig;
  testCase: TestCaseDefinition;
}
