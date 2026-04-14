import test from 'node:test';
import assert from 'node:assert/strict';
import { WebEngine } from './web_engine.js';
import type { WebConfig } from '../../model/config.js';
import type { StepDefinition } from '../../model/testcase.js';

const createConfig = (): WebConfig => ({
  baseUrls: { user: 'http://example.com' },
  defaultSite: 'user',
  headless: true,
  narrate: false,
  screenshotDir: 'screenshots',
  locatorFiles: [],
  navigationTimeout: 10,
});

const createContext = () => ({}) as never;

const createEngine = () => {
  const engine = new WebEngine(createConfig()) as unknown as {
    registry: { resolve: (target: string) => { strategy: 'css'; value: string } };
    sessions: Map<string, unknown>;
    execute: WebEngine['execute'];
  } & WebEngine;

  engine.registry = {
    resolve: (target: string) => ({ strategy: 'css', value: `#${target}` }),
  };

  return engine;
};

test('web_click waits for login readiness before clicking when configured', async () => {
  const calls: string[] = [];
  let readyChecks = 0;
  const engine = createEngine();

  engine.sessions.set('admin', {
    initialized: true,
    site: 'user',
    agent: {
      nav: async () => undefined,
      stop: async () => undefined,
      page: {
        locator: (selector: string) => ({
          fill: async () => undefined,
          click: async () => {
            calls.push(`click:${selector}`);
          },
          selectOption: async () => undefined,
          textContent: async () => null,
          screenshot: async () => undefined,
        }),
        url: () => 'http://example.com',
        screenshot: async () => undefined,
        setDefaultNavigationTimeout: () => undefined,
        setDefaultTimeout: () => undefined,
        evaluate: async () => {
          readyChecks += 1;
          calls.push('evaluate');
          return readyChecks >= 2;
        },
      },
    },
  });

  const step: StepDefinition = {
    id: 'click_login',
    type: 'web_click',
    name: '点击登录按钮',
    params: {
      session: 'admin',
      site: 'user',
      target: '登录按钮',
      waitFor: 'login_ready',
      timeout: 1000,
    },
  };

  await engine.execute(step, createContext());

  assert.deepEqual(calls, ['evaluate', 'evaluate', 'click:#登录按钮']);
});

test('web_click clicks immediately when login readiness wait is not configured', async () => {
  const calls: string[] = [];
  const engine = createEngine();

  engine.sessions.set('admin', {
    initialized: true,
    site: 'user',
    agent: {
      nav: async () => undefined,
      stop: async () => undefined,
      page: {
        locator: (selector: string) => ({
          fill: async () => undefined,
          click: async () => {
            calls.push(`click:${selector}`);
          },
          selectOption: async () => undefined,
          textContent: async () => null,
          screenshot: async () => undefined,
        }),
        url: () => 'http://example.com',
        screenshot: async () => undefined,
        setDefaultNavigationTimeout: () => undefined,
        setDefaultTimeout: () => undefined,
        evaluate: async () => {
          calls.push('evaluate');
          return true;
        },
      },
    },
  });

  const step: StepDefinition = {
    id: 'click_login',
    type: 'web_click',
    name: '点击登录按钮',
    params: {
      session: 'admin',
      site: 'user',
      target: '登录按钮',
    },
  };

  await engine.execute(step, createContext());

  assert.deepEqual(calls, ['click:#登录按钮']);
});
