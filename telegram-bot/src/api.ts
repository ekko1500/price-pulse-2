import { config } from './config';
import { logger } from './logger';
import type { Business, BotUser, Draft, ExtractResult, Product, PublishResult } from './types';

/** Error thrown for any non-2xx response from the web API. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** Pull the session cookie (`pp_session=…`) out of a login response. */
function extractSessionCookie(res: Response): string | null {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const all: string[] = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter((v): v is string => Boolean(v));
  for (const raw of all) {
    const match = /(?:^|,\s*)pp_session=([^;,\s]+)/.exec(raw);
    if (match) return `pp_session=${match[1]}`;
  }
  return null;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  cookie?: string | null;
}

interface ApiEnvelope {
  message?: string;
  error?: string;
}

/**
 * Thin client over the PricePulse HTTP API. All AI extraction, validation,
 * audit and notification logic lives in the web app; the bot only orchestrates.
 */
export class PulseApi {
  constructor(private readonly cookie: string | null = null) {}

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.cookie) headers.Cookie = this.cookie;

    try {
      const res = await fetch(`${config.apiUrl}${path}`, {
        method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const text = await res.text();
      let data: unknown = undefined;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!res.ok) {
        const envelope = (data ?? {}) as ApiEnvelope;
        throw new ApiError(envelope.message || `${res.status} ${res.statusText}`, res.status, envelope.error);
      }
      return data as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new ApiError(`The server did not respond within ${config.requestTimeoutMs} ms.`, 0, 'TIMEOUT');
      }
      logger.error(`Request to ${path} failed:`, err);
      throw new ApiError(`Could not reach the PricePulse server at ${config.apiUrl}.`, 0, 'NETWORK');
    } finally {
      clearTimeout(timer);
    }
  }

  /** Authenticate and return the session cookie plus the account profile. */
  static async login(username: string, password: string): Promise<{ cookie: string; user: BotUser; business: Business }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const res = await fetch(`${config.apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });
      const text = await res.text();
      const data = text ? (JSON.parse(text) as { user?: BotUser; business?: Business; message?: string }) : {};
      if (!res.ok) {
        throw new ApiError(data.message || `${res.status} ${res.statusText}`, res.status);
      }
      const cookie = extractSessionCookie(res);
      if (!cookie || !data.user || !data.business) {
        throw new ApiError('The server did not return a session.', 500);
      }
      return { cookie, user: data.user, business: data.business };
    } finally {
      clearTimeout(timer);
    }
  }

  bootstrap(): Promise<{ products: Product[]; drafts: Draft[]; user: BotUser; business: Business }> {
    return this.request('/api/bootstrap');
  }

  products(): Promise<{ products: Product[] }> {
    return this.request('/api/products');
  }

  extract(message: string): Promise<ExtractResult> {
    return this.request('/api/prices/extract', { body: { message } });
  }

  patchDraft(id: string, patch: Partial<{ productId: string; newPrice: number; unit: string; effectiveDate: string }>): Promise<{ draft: Draft }> {
    return this.request(`/api/prices/drafts/${id}`, { method: 'PATCH', body: patch });
  }

  confirmDraft(id: string): Promise<PublishResult> {
    return this.request(`/api/prices/drafts/${id}/confirm`, { method: 'POST' });
  }

  rejectDraft(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/prices/drafts/${id}`, { method: 'DELETE' });
  }

  logout(): Promise<void> {
    return this.request('/api/auth/logout', { method: 'POST' });
  }
}
