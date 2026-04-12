import { ValidationError } from '../common/errors.js';

const containsWord = (sql: string, word: string) => new RegExp(`\\b${word}\\b`, 'i').test(sql);

export const validateSqlSafety = (sql: string): void => {
  const normalized = sql.trim();

  if (containsWord(normalized, 'drop') || containsWord(normalized, 'truncate')) {
    throw new ValidationError(`SQL 包含危险操作: ${normalized}`);
  }

  if ((containsWord(normalized, 'delete') || containsWord(normalized, 'update')) && !containsWord(normalized, 'where')) {
    throw new ValidationError(`SQL 缺少 WHERE 条件: ${normalized}`);
  }
};
