import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplate } from './template_validator.js';
import { ValidationError } from '../common/errors.js';
import type { TestCaseDefinition } from '../model/testcase.js';

const createCase = (stepType: string): TestCaseDefinition => ({
  caseId: 'TC_DB_QUERY_001',
  caseName: 'db_query 校验',
  description: '允许 db_query 步骤通过模板校验',
  mode: 'hybrid',
  mainSteps: [
    {
      id: 'query_01',
      type: stepType,
      name: '查询订单',
      params: {
        sql: "SELECT trans_no FROM trade_order WHERE trans_no = '2043602679774846976'",
      },
      extract: {
        transNo: '$.rows[0].trans_no',
      },
    },
  ],
});

test('validateTemplate accepts db_query steps', () => {
  assert.doesNotThrow(() => validateTemplate(createCase('db_query')));
});

test('validateTemplate still rejects unsupported step types', () => {
  assert.throws(() => validateTemplate(createCase('db_read')), (error: unknown) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /不支持的步骤类型/);
    return true;
  });
});

test('validateTemplate accepts stepDelayMs range config', () => {
  const testCase = createCase('db_query');
  testCase.config = {
    stepDelayMs: {
      min: 3000,
      max: 5000,
    },
  };

  assert.doesNotThrow(() => validateTemplate(testCase));
});

test('validateTemplate rejects negative stepDelayMs min', () => {
  const testCase = createCase('db_query');
  testCase.config = {
    stepDelayMs: {
      min: -1,
      max: 5000,
    },
  };

  assert.throws(() => validateTemplate(testCase), (error: unknown) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /stepDelayMs/);
    return true;
  });
});

test('validateTemplate rejects stepDelayMs max smaller than min', () => {
  const testCase = createCase('db_query');
  testCase.config = {
    stepDelayMs: {
      min: 5000,
      max: 3000,
    },
  };

  assert.throws(() => validateTemplate(testCase), (error: unknown) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /stepDelayMs/);
    return true;
  });
});

test('validateTemplate rejects malformed stepDelayMs config', () => {
  const testCase = createCase('db_query');
  testCase.config = {
    stepDelayMs: 3000 as unknown as { min: number; max: number },
  };

  assert.throws(() => validateTemplate(testCase), (error: unknown) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /stepDelayMs/);
    return true;
  });
});
