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

  private async executeAssert(step: StepDefinition, context: ExecutionContext): Promise<unknown> {
    const sql = String(step.params.sql ?? '');
    guardSql(sql);
    const [rows] = await this.pool.query(sql);
    const normalizedRows = Array.isArray(rows) ? rows : [];
    const firstRow = (normalizedRows[0] as Record<string, unknown> | undefined) ?? {};
    const expected = (step.params.expected as Record<string, unknown> | undefined) ?? {};

    Object.entries(expected).forEach(([key, value]) => {
      if (firstRow[key] !== value) {
        throw new ExecutionError(`数据库断言失败: ${key}，期望 ${String(value)}，实际 ${String(firstRow[key])}`);
      }
    });

    context.setLastDbRows(normalizedRows);
    return { rows: normalizedRows, expected };
  }
}
