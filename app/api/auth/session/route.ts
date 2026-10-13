import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { json, handleError } from '@/lib/api/http';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const ctx = getAuthContext(req);
    if (!ctx) return json({ authenticated: false });
    return json({ authenticated: true, user: ctx.user, business: ctx.business, isDemo: ctx.isDemo });
  } catch (e) {
    return handleError(e);
  }
}
