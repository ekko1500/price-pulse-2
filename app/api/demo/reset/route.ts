import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, handleError } from '@/lib/api/http';
import { recordAudit } from '@/lib/services/events';

/**
 * Reset the isolated demo dataset. Admin only. Only touches isDemo records.
 * Safe to retry. The acting admin's session is preserved.
 */
export async function POST(req: NextRequest) {
  try {
    const g = guard(req, ['admin']);
    if (g.response) return g.response;
    const ctx = g.ctx!;

    return await dbStore.exclusive(async () => {
      const result = dbStore.resetDemo();
      recordAudit(dbStore.getData(), {
        actorId: ctx.user.id,
        actorName: ctx.business.name,
        actorRole: ctx.user.role,
        action: 'DEMO_RESET',
        targetType: 'SYSTEM',
        targetId: 'demo',
        details: result,
        isDemo: true,
      });
      dbStore.persist();
      return json({ success: true, ...result });
    });
  } catch (e) {
    return handleError(e);
  }
}
