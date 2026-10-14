import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { createSale, SaleError } from '@/lib/services/sales';
import { SalePaymentMethod } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** List sales the caller is allowed to see (their own business, or all for admin). */
export async function GET(req: NextRequest) {
  try {
    await dbStore.ready();
    const g = guard(req, ['retailer', 'wholesaler', 'admin']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const data = dbStore.getData();
    const sales = ctx.user.role === 'admin'
      ? Object.values(data.sales)
      : Object.values(data.sales).filter((s) => s.sellerId === ctx.business.id);
    sales.sort((a, b) => (a.soldAt < b.soldAt ? 1 : -1));
    return json({ sales });
  } catch (e) {
    return handleError(e);
  }
}

/** Retailer or wholesaler completes a POS sale from their terminal. */
export async function POST(req: NextRequest) {
  try {
    await dbStore.ready();
    const g = guard(req, ['retailer', 'wholesaler']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);

    const input = {
      items: body.items as Array<{ productId: string; quantity: number }>,
      customerName: typeof body.customerName === 'string' ? body.customerName : undefined,
      customerPhone: typeof body.customerPhone === 'string' ? body.customerPhone : undefined,
      discount: Number(body.discount ?? 0),
      paymentMethod: typeof body.paymentMethod === 'string' ? (body.paymentMethod as SalePaymentMethod) : undefined,
      amountPaid: Number(body.amountPaid ?? 0),
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    };

    return await dbStore.exclusive(async () => {
      try {
        const sale = createSale(dbStore.getData(), ctx, input);
        return json({ sale }, 201);
      } catch (err) {
        if (err instanceof SaleError) return fail(err.code, err.message, err.status);
        throw err;
      }
    });
  } catch (e) {
    return handleError(e);
  }
}