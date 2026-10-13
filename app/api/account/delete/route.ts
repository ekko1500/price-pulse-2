import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { recordAudit } from '@/lib/services/events';

/**
 * Self-service account closure.
 *
 * DATA RETENTION: to preserve audit integrity we do NOT hard-delete business
 * records. We deactivate the account, anonymise direct contact details, and
 * suspend connections. Orders/audit logs are retained (as required for audit);
 * the user's export (see /api/account/export) gives them their full data copy.
 */
export async function POST(req: NextRequest) {
  try {
    const g = guard(req);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);
    if (body.confirm !== 'DELETE') return fail('VALIDATION', "Type DELETE to confirm account closure.", 422);

    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const user = data.users[ctx.user.id];
      const business = data.businesses[ctx.business.id];
      if (!user || !business) return fail('NOT_FOUND', 'Account not found.', 404);

      user.isActive = false;
      user.phoneNumber = 'redacted';
      business.name = `${business.name} (closed)`;
      business.phoneNumber = 'redacted';
      business.address = undefined;
      data.users[user.id] = user;
      data.businesses[business.id] = business;

      for (const c of Object.values(data.connections)) {
        if ((c.retailerId === business.id || c.wholesalerId === business.id) && c.status === 'active') {
          c.status = 'suspended';
          c.respondedAt = new Date().toISOString();
        }
      }
      // Invalidate sessions.
      for (const [tok, s] of Object.entries(data.sessions)) {
        if (s.userId === user.id) delete data.sessions[tok];
      }

      recordAudit(data, {
        actorId: user.id, actorName: business.name, actorRole: user.role,
        action: 'ACCOUNT_CLOSED', targetType: 'USER', targetId: user.id,
        details: { retention: 'orders and audit logs retained' }, isDemo: user.isDemo,
      });
      return json({ success: true });
    });
  } catch (e) {
    return handleError(e);
  }
}
