import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { transitionOrder, OrderError } from '@/lib/services/orders';
import { OrderStatus } from '@/lib/types';

const VALID: OrderStatus[] = [
  'pending', 'accepted', 'preparing', 'ready', 'delivered', 'receipt_confirmed', 'rejected', 'cancelled',
];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const g = guard(req, ['retailer', 'wholesaler', 'admin']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);
    const status = String(body.status ?? '') as OrderStatus;
    if (!VALID.includes(status)) return fail('VALIDATION', 'Unknown order status.', 422);

    return await dbStore.exclusive(async () => {
      try {
        const order = transitionOrder(dbStore.getData(), ctx, params.id, status);
        return json({ order });
      } catch (err) {
        if (err instanceof OrderError) return fail(err.code, err.message, err.status);
        throw err;
      }
    });
  } catch (e) {
    return handleError(e);
  }
}
