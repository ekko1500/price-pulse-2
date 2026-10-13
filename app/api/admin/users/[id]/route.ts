import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { recordAudit } from '@/lib/services/events';

/** Activate / deactivate an account. Admins cannot deactivate themselves. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const g = guard(req, ['admin']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);

    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const user = data.users[params.id];
      if (!user) return fail('NOT_FOUND', 'User not found.', 404);
      if (user.id === ctx.user.id && body.isActive === false) {
        return fail('VALIDATION', 'You cannot deactivate your own account.', 422);
      }
      const before = user.isActive;
      user.isActive = Boolean(body.isActive);
      data.users[user.id] = user;

      recordAudit(data, {
        actorId: ctx.user.id, actorName: ctx.business.name, actorRole: ctx.user.role,
        action: user.isActive ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED',
        targetType: 'USER', targetId: user.id,
        details: { before, after: user.isActive }, isDemo: user.isDemo,
      });
      return json({ user: { id: user.id, isActive: user.isActive } });
    });
  } catch (e) {
    return handleError(e);
  }
}
