import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { clearSessionCookie, destroySession, SESSION_COOKIE } from '@/lib/auth/session';
import { json, handleError } from '@/lib/api/http';

export async function POST(req: NextRequest) {
  try {
    await dbStore.ready();
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    destroySession(token);
    const res = json({ success: true });
    clearSessionCookie(res);
    await dbStore.flush();
    return res;
  } catch (e) {
    return handleError(e);
  }
}
