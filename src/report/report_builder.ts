import fs from 'node:fs/promises';
import path from 'node:path';
import type { ReportConfig } from '../model/config.js';
import type { CaseExecutionResult } from '../model/result.js';
import type { ReportArtifact, ReportModel } from '../model/report_model.js';
import { ensureDir, resolveFromCwd } from '../common/file_utils.js';

const buildBaseName = (result: CaseExecutionResult): string => `${result.caseId}-${Date.now()}`;

export const writeJsonReport = async (result: CaseExecutionResult, reportDir: string): Promise<ReportArtifact> => {
  await ensureDir(reportDir);
  const filePath = path.join(reportDir, `${buildBaseName(result)}.json`);
  await fs.writeFile(filePath, JSON.stringify(result, null, 2), 'utf-8');
  return { format: 'json', filePath };
};

export const writeMarkdownReport = async (result: CaseExecutionResult, reportDir: string): Promise<ReportArtifact> => {
  await ensureDir(reportDir);
  const filePath = path.join(reportDir, `${buildBaseName(result)}.md`);
  const lines = [
    `# 执行报告 - ${result.caseName}`,
    '',
    `- 用例ID: ${result.caseId}`,
    `- 状态: ${result.status}`,
    `- 开始时间: ${result.startedAt}`,
    `- 结束时间: ${result.endedAt}`,
    `- 总耗时(ms): ${result.durationMs}`,
    '',
    '## 步骤结果',
    '',
    '| 阶段 | 步骤ID | 步骤名称 | 类型 | 状态 | 耗时(ms) | 错误 |',
    '|---|---|---|---|---|---:|---|',
    ...result.stepResults.map((step) =>
      `| ${step.phase} | ${step.stepId} | ${step.stepName} | ${step.type} | ${step.status} | ${step.durationMs} | ${step.error ?? ''} |`,
    ),
  ];

  if (result.errors.length > 0) {
    lines.push('', '## 错误摘要', '', ...result.errors.map((error) => `- ${error}`));
  }

  await fs.writeFile(filePath, `${lines.join('\n')}\n`, 'utf-8');
  return { format: 'md', filePath };
};

export const buildReport = async (result: CaseExecutionResult, config: ReportConfig): Promise<ReportModel> => {
  const reportDir = resolveFromCwd(config.outputDir);
  const artifacts: ReportArtifact[] = [];

  if (config.formats.includes('json')) {
    artifacts.push(await writeJsonReport(result, reportDir));
  }

  if (config.formats.includes('md')) {
    artifacts.push(await writeMarkdownReport(result, reportDir));
  }

  return { result, artifacts };
};
