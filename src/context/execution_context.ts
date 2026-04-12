import type { TestCaseDefinition } from '../model/testcase.js';

export class ExecutionContext {
  private readonly values = new Map<string, unknown>();
  private lastApiResponse?: unknown;
  private lastDbRows?: unknown;
  private lastStepOutput?: unknown;

  constructor(initialVariables: Record<string, unknown> = {}) {
    Object.entries(initialVariables).forEach(([key, value]) => this.values.set(key, value));
  }

  public get(key: string): unknown {
    if (key === 'lastApiResponse') return this.lastApiResponse;
    if (key === 'lastDbRows') return this.lastDbRows;
    if (key === 'lastStepOutput') return this.lastStepOutput;
    return this.values.get(key);
  }

  public set(key: string, value: unknown): void {
    this.values.set(key, value);
  }

  public setLastApiResponse(value: unknown): void {
    this.lastApiResponse = value;
    this.lastStepOutput = value;
  }

  public setLastDbRows(value: unknown): void {
    this.lastDbRows = value;
    this.lastStepOutput = value;
  }

  public setLastStepOutput(value: unknown): void {
    this.lastStepOutput = value;
  }

  public merge(values: Record<string, unknown>): void {
    Object.entries(values).forEach(([key, value]) => this.set(key, value));
  }

  public snapshot(): Record<string, unknown> {
    return {
      ...Object.fromEntries(this.values.entries()),
      lastApiResponse: this.lastApiResponse,
      lastDbRows: this.lastDbRows,
      lastStepOutput: this.lastStepOutput,
    };
  }
}

export const createExecutionContext = (testCase: TestCaseDefinition): ExecutionContext =>
  new ExecutionContext(testCase.variables ?? {});
