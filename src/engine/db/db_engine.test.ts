import test from 'node:test';
import assert from 'node:assert/strict';
import { DbEngine } from './db_engine.js';
import type { StepDefinition } from '../../model/testcase.js';
import { ExecutionError } from '../../common/errors.js';

const createEngine = () => {
  const engine = new DbEngine({
    host: '127.0.0.1',
    port: 3306,
    database: 'test',
    username: 'root',
    password: 'root',
    connectionLimit: 1,
  }) as unknown as {
    pool: { query: (sql: string) => Promise<[unknown]> };
    execute: DbEngine['execute'];
  } & DbEngine;

  return engine;
};

const createContext = () => ({
  lastDbRows: undefined as unknown,
  setLastDbRows(value: unknown) {
    this.lastDbRows = value;
  },
}) as never;

test('db_query returns rows and stores them in context', async () => {
  const engine = createEngine();
  const context = createContext();
  let queriedSql = '';

  engine.pool = {
    query: async (sql: string) => {
      queriedSql = sql;
      return [[{ code: '800342', transNo: '2043602679774846976' }]];
    },
  };

  const step: StepDefinition = {
    id: 'query_code',
    type: 'db_query',
    name: '查询验证码',
    params: {
      sql: "SELECT code, trans_no AS transNo FROM verification_log WHERE target = '1907486821@qq.com'",
    },
  };

  const result = await engine.execute(step, context);

  assert.equal(queriedSql, "SELECT code, trans_no AS transNo FROM verification_log WHERE target = '1907486821@qq.com'");
  assert.deepEqual(result, {
    rows: [{ code: '800342', transNo: '2043602679774846976' }],
  });
  assert.deepEqual(context.lastDbRows, [{ code: '800342', transNo: '2043602679774846976' }]);
});

test('db_query polls until rows are available within timeout', async () => {
  const engine = createEngine();
  const context = createContext();
  let attempts = 0;

  engine.pool = {
    query: async () => {
      attempts += 1;
      return [attempts >= 3 ? [{ code: '949180' }] : []];
    },
  };

  const step: StepDefinition = {
    id: 'query_eventually',
    type: 'db_query',
    name: '轮询查询验证码',
    params: {
      sql: "SELECT content FROM dc_sms_log WHERE targetNo = '1907486821@qq.com' ORDER BY createTime DESC LIMIT 1",
      timeout: 1000,
      pollInterval: 1,
    },
  };

  const result = await engine.execute(step, context);

  assert.equal(attempts, 3);
  assert.deepEqual(result, {
    rows: [{ code: '949180' }],
  });
  assert.deepEqual(context.lastDbRows, [{ code: '949180' }]);
});

test('db_assert polls until expected row appears within timeout', async () => {
  const engine = createEngine();
  const context = createContext();
  let attempts = 0;

  engine.pool = {
    query: async () => {
      attempts += 1;
      return [attempts >= 2 ? [{ transStatus: 'PROCESSING' }] : [{ transStatus: 'WAITING' }]];
    },
  };

  const step: StepDefinition = {
    id: 'assert_eventually',
    type: 'db_assert',
    name: '轮询断言处理中状态',
    params: {
      sql: "SELECT transStatus FROM dc_transaction WHERE transNo = '2043602679774846976'",
      expected: {
        transStatus: 'PROCESSING',
      },
      timeout: 1000,
      pollInterval: 1,
    },
  };

  const result = await engine.execute(step, context);

  assert.equal(attempts, 2);
  assert.deepEqual(result, {
    rows: [{ transStatus: 'PROCESSING' }],
    expected: { transStatus: 'PROCESSING' },
  });
  assert.deepEqual(context.lastDbRows, [{ transStatus: 'PROCESSING' }]);
});

