import type { CaseExecutionResult } from './result.js';

export interface ReportArtifact {
  format: 'json' | 'md';
  filePath: string;
}

export interface ReportModel {
  result: CaseExecutionResult;
  artifacts: ReportArtifact[];
}
