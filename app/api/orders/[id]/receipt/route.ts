import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, handleError } from '@/lib/api/http';
import { confirmReceipt, OrderError } from '@/lib/services/orders';

/**
 * Retailer explicitly confirms physical receipt. This is the ONLY action that
 * increases retailer stock. Idempotent: repeat calls return 409 and add nothing.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const g = guard(req, ['retailer']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    return await dbStore.exclusive(async () => {
      try {
        const order = confirmReceipt(dbStore.getData(), ctx, params.id);
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
