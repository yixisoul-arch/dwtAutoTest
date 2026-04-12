import { ValidationError } from '../../common/errors.js';

const containsWord = (sql: string, word: string): boolean => new RegExp(`\\b${word}\\b`, 'i').test(sql);

export const guardSql = (sql: string): void => {
  if (containsWord(sql, 'drop') || containsWord(sql, 'truncate')) {
    throw new ValidationError(`禁止执行危险 SQL: ${sql}`);
  }

  if ((containsWord(sql, 'delete') || containsWord(sql, 'update')) && !containsWord(sql, 'where')) {
    throw new ValidationError(`SQL 缺少 WHERE 条件: ${sql}`);
  }
};
