import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { createSession, setSessionCookie, toPublicUser } from '@/lib/auth/session';
import { json, fail, readJson, handleError } from '@/lib/api/http';

/**
 * One-click demo access. ONLY maps fixed persona keys to seeded demo accounts.
 * It is impossible to use this endpoint to access a real (non-demo) account.
 */
const PERSONAS: Record<string, string> = {
  wholesaler: 'user-wholesaler-1',
  wholesaler2: 'user-wholesaler-2',
  retailer: 'user-retailer-1',
  retailer2: 'user-retailer-2',
  admin: 'user-admin',
};

export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const persona = String(body.persona ?? '');
    const userId = PERSONAS[persona];
    if (!userId) return fail('VALIDATION', 'Unknown demo persona.', 422);

    const data = dbStore.getData();
    const user = data.users[userId];
    if (!user || !user.isDemo) {
      return fail('NOT_FOUND', 'Demo account is not available. An administrator may need to reset the demo data.', 404);
    }
    if (!user.isActive) return fail('ACCOUNT_DISABLED', 'This demo account is deactivated.', 403);

    const business = data.businesses[user.businessId];
    if (!business) return fail('SERVER_ERROR', 'Demo business profile missing.', 500);

    const session = createSession(user);
    await dbStore.flush();
    const res = json({ user: toPublicUser(user), business, demo: true });
    setSessionCookie(res, session.token);
    return res;
  } catch (e) {
    return handleError(e);
  }
}
