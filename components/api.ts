export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  message?: string;
  fields?: Record<string, string>;
}

/**
 * Base URL for the backend API.
 *
 * Production (Firebase Hosting → Cloud Run): leave this empty. Firebase Hosting
 * rewrites `/api/**` to the Cloud Run service, so requests stay same-origin and
 * the session cookie keeps working without CORS or SameSite changes.
 *
 * If you instead call Cloud Run directly from another origin, set
 * NEXT_PUBLIC_API_BASE_URL=https://<service>.a.run.app (and then you also need
 * CORS + `SameSite=None; Secure` cookies on the backend).
 */
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');

/** Resolve an API path against the configured backend base (absolute URLs pass through). */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith('/')) path = `/${path}`;
  return `${API_BASE}${path}`;
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { json?: unknown } = {}
): Promise<ApiResult<T>> {
  const { json, ...rest } = options;
  const init: RequestInit = { ...rest, credentials: 'include', headers: { ...(rest.headers || {}) } };
  if (json !== undefined) {
    init.method = init.method || 'POST';
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(json);
  }
  try {
    const res = await fetch(apiUrl(path), init);
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : undefined;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: (data as { error?: string })?.error,
        message: (data as { message?: string })?.message,
        fields: (data as { fields?: Record<string, string> })?.fields,
      };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch (e) {
    return { ok: false, status: 0, error: 'NETWORK', message: (e as Error).message };
  }
}
