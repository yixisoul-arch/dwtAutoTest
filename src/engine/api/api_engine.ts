import type { ApiConfig } from '../../model/config.js';
import type { StepDefinition } from '../../model/testcase.js';
import type { ExecutionContext } from '../../context/execution_context.js';
import { ExecutionError } from '../../common/errors.js';
import { assertApiField } from './api_assertions.js';

export class ApiEngine {
  constructor(private readonly config: ApiConfig) {}

  public async execute(step: StepDefinition, context: ExecutionContext): Promise<unknown> {
    switch (step.type) {
      case 'api_call':
        return this.call(step, context);
      case 'api_assert_field':
        return this.assertField(step, context);
      default:
        throw new ExecutionError(`API 引擎不支持步骤类型: ${step.type}`);
    }
  }

  private async call(step: StepDefinition, context: ExecutionContext): Promise<unknown> {
    const method = String(step.params.method ?? 'GET').toUpperCase();
    const url = this.resolveUrl(String(step.params.url ?? ''));
    const headers = {
      ...(this.config.defaultHeaders ?? {}),
      ...((step.params.headers as Record<string, string> | undefined) ?? {}),
    };
    const query = (step.params.query as Record<string, string | number> | undefined) ?? undefined;
    const body = step.params.body;
    const requestUrl = new URL(url);

    if (query) {
      Object.entries(query).forEach(([key, value]) => requestUrl.searchParams.set(key, String(value)));
    }

    const response = await fetch(requestUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const enriched = {
      status: response.status,
      headers: responseHeaders,
      body: payload,
    };

    context.setLastApiResponse(enriched);
    return enriched;
  }

  private assertField(step: StepDefinition, context: ExecutionContext): unknown {
    const payload = context.get('lastApiResponse');
    if (!payload || typeof payload !== 'object') {
      throw new ExecutionError('没有可供断言的 API 响应');
    }

    const field = String(step.params.field ?? '');
    const expected = step.params.expected;
    const body = (payload as { body?: unknown }).body;
    assertApiField(body, field, expected);
    return { field, expected };
  }

  private resolveUrl(rawUrl: string): string {
    if (/^https?:\/\//i.test(rawUrl)) {
      return rawUrl;
    }

    return new URL(rawUrl, this.config.baseUrl).toString();
  }
}
