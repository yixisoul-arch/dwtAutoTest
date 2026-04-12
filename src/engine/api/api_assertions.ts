import { extractByPath } from '../../parser/variable_resolver.js';
import { ExecutionError } from '../../common/errors.js';

export const assertApiField = (payload: unknown, field: string, expected: unknown): void => {
  const actual = extractByPath(payload, field);
  if (actual !== expected) {
    throw new ExecutionError(`接口断言失败: ${field}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
};
