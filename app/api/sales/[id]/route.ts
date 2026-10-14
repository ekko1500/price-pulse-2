import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, handleError } from '@/lib/api/http';
import { voidSale, SaleError } from '@/lib/services/sales';

/** A single sale the caller may see. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbStore.ready();
    const g = guard(req);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const data = dbStore.getData();
    const sale = data.sales[params.id];
    if (!sale) return fail('NOT_FOUND', 'Sale not found.', 404);
    if (sale.sellerId !== ctx.business.id && ctx.user.role !== 'admin') {
      return fail('FORBIDDEN', 'This sale belongs to another business.', 403);
    }
    return json({ sale });
  } catch (e) {
    return handleError(e);
  }
}

/** Void a completed sale (restores stock). Only the seller or an admin. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbStore.ready();
    const g = guard(req, ['retailer', 'wholesaler', 'admin']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    return await dbStore.exclusive(async () => {
      try {
        const sale = voidSale(dbStore.getData(), ctx, params.id);
        return json({ sale });
      } catch (err) {
        if (err instanceof SaleError) return fail(err.code, err.message, err.status);
        throw err;
      }
    });
  } catch (e) {
    return handleError(e);
  }
}