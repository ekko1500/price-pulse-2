import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { ConnectionStatus } from '@/lib/types';
import { recordAudit, createNotification } from '@/lib/services/events';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbStore.ready();
    const g = guard(req);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);
    const action = String(body.action ?? '');

    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const conn = data.connections[params.id];
      if (!conn) return fail('NOT_FOUND', 'Connection not found.', 404);

      const isWholesaler = ctx.business.id === conn.wholesalerId;
      const isRetailer = ctx.business.id === conn.retailerId;
      const isAdmin = ctx.user.role === 'admin';
      if (!isWholesaler && !isRetailer && !isAdmin) return fail('FORBIDDEN', 'Not your connection.', 403);

      let next: ConnectionStatus | null = null;
      if (action === 'approve' || action === 'reject') {
        if (!isWholesaler && !isAdmin) return fail('FORBIDDEN', 'Only the wholesaler can decide a request.', 403);
        if (conn.status !== 'pending') return fail('INVALID_STATE', 'This request is no longer pending.', 409);
        next = action === 'approve' ? 'active' : 'rejected';
      } else if (action === 'suspend' || action === 'disconnect') {
        if (!isWholesaler && !isRetailer && !isAdmin) return fail('FORBIDDEN', 'Not your connection.', 403);
        if (conn.status !== 'active') return fail('INVALID_STATE', 'Only active connections can be suspended.', 409);
        next = 'suspended';
      } else {
        return fail('VALIDATION', 'Unknown action.', 422);
      }

      conn.status = next;
      conn.respondedAt = new Date().toISOString();
      data.connections[conn.id] = conn;

      const notifyId = isWholesaler || (isAdmin && action !== 'reject') ? conn.retailerId : conn.wholesalerId;
      createNotification(data, {
        recipientId: notifyId,
        title: `Connection ${next}`,
        body: `Your connection with ${ctx.business.name} is now ${next}.`,
        type: 'connection_decision',
        link: isWholesaler ? '/retailer/connections' : '/wholesaler/connections',
        dedupeKey: `conn:${conn.id}:${next}`,
        isDemo: ctx.isDemo,
      });
      recordAudit(data, {
        actorId: ctx.user.id, actorName: ctx.business.name, actorRole: ctx.user.role,
        action: `CONNECTION_${next.toUpperCase()}`, targetType: 'CONNECTION', targetId: conn.id,
        details: { to: next }, isDemo: ctx.isDemo,
      });
      return json({ connection: conn });
    });
  } catch (e) {
    return handleError(e);
  }
}
