import { JSONPath } from 'jsonpath-plus';
import { ValidationError } from '../common/errors.js';

const VARIABLE_PATTERN = /\$\{([^}]+)\}/g;

const resolvePath = (source: Record<string, unknown>, path: string): unknown => {
  return path
    .split('.')
    .reduce<unknown>((current, key) => {
      if (current === undefined || current === null) {
        return undefined;
      }

      if (typeof current !== 'object') {
        return undefined;
      }

      return (current as Record<string, unknown>)[key];
    }, source);
};

const replaceInString = (value: string, scope: Record<string, unknown>): string => {
  return value.replace(VARIABLE_PATTERN, (_, expression: string) => {
    const trimmed = expression.trim();
    const resolved = resolvePath(scope, trimmed);

    if (resolved === undefined) {
      throw new ValidationError(`无法解析变量: ${trimmed}`);
    }

    return String(resolved);
  });
};

const resolveNode = <T>(value: T, scope: Record<string, unknown>): T => {
  if (typeof value === 'string') {
    return replaceInString(value, scope) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveNode(item, scope)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, resolveNode(nested, scope)]),
    ) as T;
  }

  return value;
};

export const buildVariableScope = (
  variables: Record<string, unknown> = {},
  context: Record<string, unknown> = {},
  defaults: Record<string, unknown> = {},
): Record<string, unknown> => ({
  ...defaults,
  ...variables,
  context,
});

export const resolveVariables = <T>(value: T, scope: Record<string, unknown>): T => resolveNode(value, scope);

export const extractByPath = (payload: unknown, expression: string): unknown => {
  if (payload === undefined) {
    return undefined;
  }

  const normalizedPayload =
    payload === null || typeof payload === 'string' || typeof payload === 'number' || typeof payload === 'boolean'
      ? payload
      : (payload as object | unknown[]);

  const result = JSONPath({ path: expression, json: normalizedPayload });
  if (!Array.isArray(result) || result.length === 0) {
    return undefined;
  }

  return result[0];
};
