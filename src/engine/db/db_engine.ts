import mysql from 'mysql2/promise';
import type { DbConfig } from '../../model/config.js';
import type { StepDefinition } from '../../model/testcase.js';
import type { ExecutionContext } from '../../context/execution_context.js';
import { ExecutionError } from '../../common/errors.js';
import { guardSql } from './sql_guard.js';

export class DbEngine {
  private readonly pool;

  constructor(private readonly config: DbConfig) {
    this.pool = mysql.createPool({
      host: config.host,
      port: Number(config.port),
      database: config.database,
      user: config.username,
      password: config.password,
      connectionLimit: config.connectionLimit ?? 5,
    });
  }

  public async execute(step: StepDefinition, context: ExecutionContext): Promise<unknown> {
    switch (step.type) {
      case 'db_init':
      case 'db_cleanup':
        return this.executeMutation(step);
      case 'db_query':
        return this.executeQuery(step, context);
      case 'db_assert':
        return this.executeAssert(step, context);
      default:
        throw new ExecutionError(`DB 引擎不支持步骤类型: ${step.type}`);
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  private async executeMutation(step: StepDefinition): Promise<unknown> {
    const sql = String(step.params.sql ?? '');
    guardSql(sql);
    const [result] = await this.pool.query(sql);
    return result;
  }

  private async executeQuery(step: StepDefinition, context: ExecutionContext): Promise<unknown> {
    const normalizedRows = await this.queryRows(step, {
      timeoutMs: Number(step.params.timeout ?? 0),
      pollIntervalMs: Number(step.params.pollInterval ?? 250),
      shouldRetry: (rows) => rows.length === 0,
    });
    context.setLastDbRows(normalizedRows);
    return { rows: normalizedRows };
  }

  private async executeAssert(step: StepDefinition, context: ExecutionContext): Promise<unknown> {
    const expected = (step.params.expected as Record<string, unknown> | undefined) ?? {};
    const normalizedRows = await this.queryRows(step, {
      timeoutMs: Number(step.params.timeout ?? 0),
      pollIntervalMs: Number(step.params.pollInterval ?? 250),
      shouldRetry: (rows) => !this.matchesExpected(rows, expected),
    });

    if (!this.matchesExpected(normalizedRows, expected)) {
      const firstRow = (normalizedRows[0] as Record<string, unknown> | undefined) ?? {};
      Object.entries(expected).forEach(([key, value]) => {
        if (firstRow[key] !== value) {
          throw new ExecutionError(`数据库断言失败: ${key}，期望 ${String(value)}，实际 ${String(firstRow[key])}`);
        }
      });
    }

    context.setLastDbRows(normalizedRows);
    return { rows: normalizedRows, expected };
  }

  private matchesExpected(rows: Record<string, unknown>[], expected: Record<string, unknown>): boolean {
    const firstRow = (rows[0] as Record<string, unknown> | undefined) ?? {};
    return Object.entries(expected).every(([key, value]) => firstRow[key] === value);
  }

  private async queryRows(
    step: StepDefinition,
    options?: {
      timeoutMs?: number;
      pollIntervalMs?: number;
      shouldRetry?: (rows: Record<string, unknown>[]) => boolean;
    },
  ): Promise<Record<string, unknown>[]> {
    const sql = step.params.sql;
    if (typeof sql !== 'string' || sql.trim().length === 0) {
      throw new ExecutionError(`数据库步骤缺少 sql: ${step.id}`);
    }

    guardSql(sql);
    const timeoutMs = Math.max(0, Number(options?.timeoutMs ?? 0));
    const pollIntervalMs = Math.max(1, Number(options?.pollIntervalMs ?? 250));
    const shouldRetry = options?.shouldRetry;
    const startedAt = Date.now();

    while (true) {
      const [rows] = await this.pool.query(sql);
      const normalizedRows = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
      if (!shouldRetry || !shouldRetry(normalizedRows)) {
        return normalizedRows;
      }

      if (timeoutMs <= 0 || Date.now() - startedAt >= timeoutMs) {
        return normalizedRows;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }
}
