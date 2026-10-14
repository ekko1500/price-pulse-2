import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    await dbStore.ready();
    const g = guard(req);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const data = dbStore.getData();
    const notifications = Object.values(data.notifications)
      .filter((n) => n.recipientId === ctx.business.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const unread = notifications.filter((n) => !n.read).length;
    return json({ notifications, unread });
  } catch (e) {
    return handleError(e);
  }
}

/** Mark one (id) or all notifications read. Only the recipient can do so. */
export async function PATCH(req: NextRequest) {
  try {
    await dbStore.ready();
    const g = guard(req);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);
    const id = typeof body.id === 'string' ? body.id : '';
    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      let changed = 0;
      for (const n of Object.values(data.notifications)) {
        if (n.recipientId !== ctx.business.id) continue;
        if ((id && n.id === id) || (!id && !n.read)) {
          if (!n.read) { n.read = true; changed += 1; }
        }
      }
      return json({ success: true, changed });
    });
  } catch (e) {
    return handleError(e);
  }
}
