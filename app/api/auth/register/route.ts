import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { Business, User } from '@/lib/types';
import { hashPassword } from '@/lib/auth/password';
import { createSession, setSessionCookie, toPublicUser } from '@/lib/auth/session';
import { cleanString, normalizePhone, validateRegistration } from '@/lib/validation';
import { json, fail, readJson, handleError } from '@/lib/api/http';
import { recordAudit } from '@/lib/services/events';
import { makeId } from '@/lib/util/id';

export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const errors = validateRegistration(body);
    if (Object.keys(errors).length > 0) {
      return json({ error: 'VALIDATION', fields: errors, message: 'Please correct the highlighted fields.' }, 422);
    }

    // Note: role is explicitly limited to retailer/wholesaler. Admin cannot self-register.
    const role = body.role as 'retailer' | 'wholesaler';
    const username = String(body.username).trim().toLowerCase();
    const phoneNumber = normalizePhone(body.phoneNumber)!;
    const businessName = cleanString(body.businessName);

    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const taken = Object.values(data.users).some((u) => u.username.toLowerCase() === username);
      if (taken) return fail('USERNAME_TAKEN', 'That username is already registered.', 409);

      const nowISO = new Date().toISOString();
      const userId = makeId('user');
      const businessId = makeId('biz');

      const business: Business = {
        id: businessId,
        name: businessName,
        ownerId: userId,
        role,
        phoneNumber,
        createdAt: nowISO,
        isDemo: false,
      };
      data.businesses[businessId] = business;

      const { passwordHash, passwordSalt } = hashPassword(String(body.password));
      const user: User = {
        id: userId,
        username,
        passwordHash,
        passwordSalt,
        phoneNumber,
        role,
        businessId,
        isActive: true,
        isDemo: false,
        createdAt: nowISO,
      };
      data.users[userId] = user;

      recordAudit(data, {
        actorId: userId,
        actorName: business.name,
        actorRole: role,
        action: 'ACCOUNT_REGISTERED',
        targetType: 'USER',
        targetId: userId,
        details: { role },
        isDemo: false,
      });

      const session = createSession(user);
      const res = json({ user: toPublicUser(user), business, token: undefined });
      setSessionCookie(res, session.token);
      return res;
    });
  } catch (e) {
    return handleError(e);
  }
}
