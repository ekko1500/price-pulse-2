import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, setSessionCookie, toPublicUser } from '@/lib/auth/session';
import { json, fail, readJson, handleError } from '@/lib/api/http';

export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const username = String(body.username ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!username || !password) {
      return fail('VALIDATION', 'Enter your username and password.', 422);
    }

    const data = dbStore.getData();
    const user = Object.values(data.users).find((u) => u.username.toLowerCase() === username);

    // Generic error message to avoid revealing whether the username exists.
    if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
      return fail('INVALID_CREDENTIALS', 'Incorrect username or password.', 401);
    }
    if (!user.isActive) {
      return fail('ACCOUNT_DISABLED', 'This account has been deactivated. Contact an administrator.', 403);
    }

    const business = data.businesses[user.businessId];
    if (!business) return fail('SERVER_ERROR', 'Account business profile is missing.', 500);

    const session = createSession(user);
    const res = json({ user: toPublicUser(user), business });
    setSessionCookie(res, session.token);
    return res;
  } catch (e) {
    return handleError(e);
  }
}
