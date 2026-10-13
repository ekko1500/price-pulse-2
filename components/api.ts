export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  message?: string;
  fields?: Record<string, string>;
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { json?: unknown } = {}
): Promise<ApiResult<T>> {
  const { json, ...rest } = options;
  const init: RequestInit = { ...rest, headers: { ...(rest.headers || {}) } };
  if (json !== undefined) {
    init.method = init.method || 'POST';
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(json);
  }
  try {
    const res = await fetch(path, init);
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
