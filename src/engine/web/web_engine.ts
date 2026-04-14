import type { WebConfig } from '../../model/config.js';
import type { StepDefinition } from '../../model/testcase.js';
import type { ExecutionContext } from '../../context/execution_context.js';
import { ExecutionError } from '../../common/errors.js';
import { LocatorRegistry, buildLocator, buildScreenshotPath, createBrowserAgent } from './locator_registry.js';

interface BrowserAgentLike {
  nav(url: string): Promise<void>;
  page: {
    locator(selector: string): {
      fill(value: string): Promise<void>;
      click(): Promise<void>;
      selectOption(value: string): Promise<unknown>;
      textContent(): Promise<string | null>;
      screenshot(options: { path: string }): Promise<void>;
    };
    evaluate<R>(pageFunction: () => R | Promise<R>): Promise<R>;
    url(): string;
    screenshot(options: { path: string }): Promise<void>;
    setDefaultNavigationTimeout(timeout: number): void;
    setDefaultTimeout(timeout: number): void;
  };
  stop(): Promise<void>;
}

interface WebSessionState {
  agent: BrowserAgentLike;
  initialized: boolean;
  site: string;
}

export class WebEngine {
  private readonly registry = new LocatorRegistry();
  private readonly sessions = new Map<string, WebSessionState>();

  constructor(private readonly config: WebConfig) {}

  public async init(sessionName = 'default', site = this.config.defaultSite): Promise<void> {
    const existing = this.sessions.get(sessionName);
    if (existing?.initialized) {
      if (existing.site !== site) {
        throw new ExecutionError(`会话 ${sessionName} 已绑定站点 ${existing.site}，不能切换到 ${site}`);
      }
      return;
    }

    this.requireBaseUrl(site);
    await this.registry.load(this.config.locatorFiles);
    const agent = (await createBrowserAgent(this.config.headless, this.config.narrate)) as unknown as BrowserAgentLike;
    agent.page.setDefaultNavigationTimeout(this.config.navigationTimeout ?? 30000);
    agent.page.setDefaultTimeout(this.config.navigationTimeout ?? 30000);
    this.sessions.set(sessionName, {
      agent,
      initialized: true,
      site,
    });
  }

  public async close(): Promise<void> {
    await Promise.all(Array.from(this.sessions.values()).map(async (session) => session.agent.stop()));
    this.sessions.clear();
  }

  public async execute(step: StepDefinition, _context: ExecutionContext): Promise<unknown> {
    const sessionName = this.resolveSession(step.params.session);
    const site = this.resolveExecutionSite(sessionName, step.params.site);
    await this.init(sessionName, site);
    const agent = this.requireAgent(sessionName);

    switch (step.type) {
      case 'web_open': {
        const resolvedUrl = this.resolveUrl(String(step.params.url ?? ''), site);
        await agent.nav(resolvedUrl);
        return { session: sessionName, site, url: resolvedUrl };
      }
      case 'web_input': {
        const locator = this.resolveTarget(String(step.params.target ?? ''));
        await agent.page.locator(locator).fill(String(step.params.value ?? ''));
        return { session: sessionName, target: step.params.target };
      }
      case 'web_click': {
        const locator = this.resolveTarget(String(step.params.target ?? ''));
        const timeoutMs = Number(step.params.timeout ?? this.config.navigationTimeout ?? 30000);
        await this.waitForRequestedState(agent, step.params.waitFor, timeoutMs);
        await agent.page.locator(locator).click();
        return { session: sessionName, target: step.params.target };
      }
      case 'web_select': {
        const locator = this.resolveTarget(String(step.params.target ?? ''));
        await agent.page.locator(locator).selectOption(String(step.params.value ?? ''));
        return { session: sessionName, target: step.params.target, value: step.params.value };
      }
      case 'web_assert_url': {
        const expected = this.resolveUrl(String(step.params.expected ?? ''), site);
        const timeoutMs = Number(step.params.timeout ?? this.config.navigationTimeout ?? 30000);
        const current = await this.waitForUrlContains(sessionName, expected, timeoutMs);
        return { session: sessionName, current, expected };
      }
      case 'web_assert_text': {
        const locator = this.resolveTarget(String(step.params.target ?? ''));
        const expected = String(step.params.expected ?? '');
        const timeoutMs = Number(step.params.timeout ?? this.config.navigationTimeout ?? 30000);
        const content = await this.waitForText(sessionName, locator, expected, timeoutMs);
        return { session: sessionName, target: step.params.target, expected, content };
      }
      case 'web_screenshot': {
        const screenshotPath = await buildScreenshotPath(String(step.params.fileName ?? 'screenshot.png'), this.config.screenshotDir);
        await agent.page.screenshot({ path: screenshotPath });
        return { session: sessionName, screenshotPath };
      }
      default:
        throw new ExecutionError(`Web 引擎不支持步骤类型: ${step.type}`);
    }
  }

  public async captureFailureScreenshot(fileName: string, sessionName = 'default'): Promise<string> {
    const session = this.sessions.get(sessionName);
    if (!session) {
      await this.init(sessionName, this.config.defaultSite);
    }
    const agent = this.requireAgent(sessionName);
    const screenshotPath = await buildScreenshotPath(fileName, this.config.screenshotDir);
    await agent.page.screenshot({ path: screenshotPath });
    return screenshotPath;
  }

  private requireAgent(sessionName: string): BrowserAgentLike {
    const session = this.sessions.get(sessionName);
    if (!session?.agent) {
      throw new ExecutionError(`Browser agent 尚未初始化: ${sessionName}`);
    }
    return session.agent;
  }

  private resolveTarget(target: string): string {
    return buildLocator(this.registry.resolve(target));
  }

  private async waitForRequestedState(agent: BrowserAgentLike, waitFor: unknown, timeoutMs: number): Promise<void> {
    if (waitFor === undefined) {
      return;
    }

    if (waitFor === 'login_ready') {
      await this.waitForLoginReady(agent, timeoutMs);
      return;
    }

    throw new ExecutionError(`不支持的页面等待条件: ${String(waitFor)}`);
  }

  private async waitForLoginReady(agent: BrowserAgentLike, timeoutMs: number): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
      const ready = await agent.page.evaluate(() => {
        const keys = Object.keys(window.localStorage);
        for (const key of keys) {
          if (key !== 'app.config' && !key.endsWith(':app.config')) {
            continue;
          }

          const raw = window.localStorage.getItem(key);
          if (!raw) {
            continue;
          }

          try {
            const parsed = JSON.parse(raw);
            if (
              parsed &&
              typeof parsed === 'object' &&
              typeof (parsed as { rsaPubKey?: unknown }).rsaPubKey === 'string' &&
              (parsed as { rsaPubKey: string }).rsaPubKey.trim().length > 0
            ) {
              return true;
            }
          } catch {
            continue;
          }
        }

        return false;
      });

      if (ready) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new ExecutionError('等待登录页公钥配置超时');
  }

  private async waitForUrlContains(sessionName: string, expected: string, timeoutMs: number): Promise<string> {
    const agent = this.requireAgent(sessionName);
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
      const current = agent.page.url();
      if (current.includes(expected)) {
        return current;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const current = agent.page.url();
    throw new ExecutionError(`页面 URL 断言失败，期望包含 ${expected}，实际 ${current}`);
  }

  private async waitForText(sessionName: string, locator: string, expected: string, timeoutMs: number): Promise<string> {
    const agent = this.requireAgent(sessionName);
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
      const content = (await agent.page.locator(locator).textContent()) ?? '';
      if (content.includes(expected)) {
        return content;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const content = (await agent.page.locator(locator).textContent()) ?? '';
    throw new ExecutionError(`页面文本断言失败，期望包含 ${expected}，实际 ${content}`);
  }

  private resolveUrl(rawUrl: string, site: string): string {
    if (/^https?:\/\//i.test(rawUrl)) {
      return rawUrl;
    }

    return new URL(rawUrl, this.requireBaseUrl(site)).toString();
  }

  private resolveSession(session: unknown): string {
    if (typeof session === 'string' && session.length > 0) {
      return session;
    }

    return 'default';
  }

  private resolveExecutionSite(sessionName: string, site: unknown): string {
    const existing = this.sessions.get(sessionName);
    if (existing?.site) {
      if (typeof site === 'string' && site.length > 0 && site !== existing.site) {
        throw new ExecutionError(`会话 ${sessionName} 已绑定站点 ${existing.site}，不能切换到 ${site}`);
      }

      return existing.site;
    }

    return this.resolveSite(site);
  }

  private resolveSite(site: unknown): string {
    if (typeof site === 'string' && site.length > 0) {
      return site;
    }

    return this.config.defaultSite;
  }

  private requireBaseUrl(site: string): string {
    const baseUrl = this.config.baseUrls[site];
    if (!baseUrl) {
      throw new ExecutionError(`未配置站点 baseUrl: ${site}`);
    }

    return baseUrl;
  }
}
