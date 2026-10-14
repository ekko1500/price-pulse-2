import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, handleError } from '@/lib/api/http';
import { toPublicUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    await dbStore.ready();
    const g = guard(req, ['admin']);
    if (g.response) return g.response;
    const data = dbStore.getData();

    const businesses = Object.values(data.businesses);
    const connections = Object.values(data.connections);
    const users = Object.values(data.users).map((u) => ({
      ...toPublicUser(u),
      businessName: data.businesses[u.businessId]?.name ?? '—',
      connectionCount: connections.filter(
        (c) => c.wholesalerId === u.businessId || c.retailerId === u.businessId
      ).length,
    }));

    return json({ users, businesses, connections });
  } catch (e) {
    return handleError(e);
  }
}
