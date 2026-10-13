import { NextRequest, NextResponse } from 'next/server';
import { AuthContext, getAuthContext } from '../auth/session';
import { UserRole } from '../types';

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function fail(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ error: code, message }, { status });
}

export const unauthorized = () => fail('UNAUTHORIZED', 'You must be signed in.', 401);
export const forbidden = (message = 'You are not allowed to do that.') => fail('FORBIDDEN', message, 403);

export interface GuardResult {
  ctx?: AuthContext;
  response?: NextResponse;
}

/** Authenticate the request; returns either the context or a 401 response. */
export function guard(req: NextRequest, roles?: UserRole[]): GuardResult {
  const ctx = getAuthContext(req);
  if (!ctx) return { response: unauthorized() };
  if (roles && roles.length && !roles.includes(ctx.user.role)) {
    return { response: forbidden() };
  }
  return { ctx };
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function handleError(e: unknown): NextResponse {
  if (e && typeof e === 'object' && 'status' in e && 'code' in e) {
    const err = e as { status: number; code: string; message: string };
    return fail(err.code, err.message, err.status);
  }
  console.error('Unhandled API error:', e);
  return fail('SERVER_ERROR', 'An unexpected error occurred.', 500);
}
