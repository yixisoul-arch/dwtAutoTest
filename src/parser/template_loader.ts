import type { RawTestCaseDefinition, TestCaseDefinition } from '../model/testcase.js';
import { loadTemplateFile } from './yaml_parser.js';
import { expandSharedSteps } from './shared_step_expander.js';

export interface LoadedTemplate {
  filePath: string;
  definition: TestCaseDefinition;
}

export const templateLoader = async (filePath: string): Promise<LoadedTemplate> => {
  const rawDefinition: RawTestCaseDefinition = await loadTemplateFile(filePath);

  return {
    filePath,
    definition: await expandSharedSteps(rawDefinition),
  };
};
