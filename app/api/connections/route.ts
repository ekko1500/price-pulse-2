import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { SupplierConnection } from '@/lib/types';
import { makeId } from '@/lib/util/id';
import { recordAudit, createNotification } from '@/lib/services/events';
import { cleanString } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const g = guard(req);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const data = dbStore.getData();
    const connections = Object.values(data.connections).filter((c) =>
      ctx.user.role === 'admin'
        ? true
        : ctx.user.role === 'wholesaler'
          ? c.wholesalerId === ctx.business.id
          : c.retailerId === ctx.business.id
    );
    return json({ connections });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const g = guard(req, ['retailer']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);
    const wholesalerId = cleanString(body.wholesalerId);
    if (!wholesalerId) return fail('VALIDATION', 'Choose a wholesaler.', 422);

    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const wholesaler = data.businesses[wholesalerId];
      if (!wholesaler || wholesaler.role !== 'wholesaler') {
        return fail('NOT_FOUND', 'Wholesaler not found.', 404);
      }
      if (wholesalerId === ctx.business.id) return fail('VALIDATION', 'You cannot connect to yourself.', 422);

      const existing = Object.values(data.connections).find(
        (c) => c.retailerId === ctx.business.id && c.wholesalerId === wholesalerId
      );
      if (existing && (existing.status === 'active' || existing.status === 'pending')) {
        return fail('DUPLICATE', `A ${existing.status} connection already exists with this wholesaler.`, 409);
      }

      const nowISO = new Date().toISOString();
      const connection: SupplierConnection = {
        id: makeId('conn'),
        wholesalerId,
        wholesalerName: wholesaler.name,
        retailerId: ctx.business.id,
        retailerName: ctx.business.name,
        status: 'pending',
        requestedAt: nowISO,
        isDemo: ctx.isDemo,
      };
      data.connections[connection.id] = connection;

      createNotification(data, {
        recipientId: wholesalerId,
        title: 'New connection request',
        body: `${ctx.business.name} wants to connect with your business.`,
        type: 'connection_request',
        link: '/wholesaler/connections',
        dedupeKey: `connreq:${connection.id}`,
        isDemo: ctx.isDemo,
      });
      recordAudit(data, {
        actorId: ctx.user.id, actorName: ctx.business.name, actorRole: ctx.user.role,
        action: 'CONNECTION_REQUESTED', targetType: 'CONNECTION', targetId: connection.id,
        details: { wholesalerId }, isDemo: ctx.isDemo,
      });
      return json({ connection }, 201);
    });
  } catch (e) {
    return handleError(e);
  }
}
