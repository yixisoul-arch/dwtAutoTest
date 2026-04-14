import test from 'node:test';
import assert from 'node:assert/strict';
import { extractByPath } from './variable_resolver.js';

test('extractByPath supports regex extraction after jsonpath lookup', () => {
  const payload = {
    rows: [
      {
        content: '验证码:800342，您好，感谢您选择dowalet，验证码5分钟内有效，请勿泄露给他人。',
      },
    ],
  };

  const result = extractByPath(payload, '$.rows[0].content|regex:验证码:(\\d{6})');

  assert.equal(result, '800342');
});
