import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, handleError } from '@/lib/api/http';
import { visibleProducts } from '@/lib/auth/rbac';

/** Export the caller's own business data as JSON. */
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    await dbStore.ready();
    const g = guard(req);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const data = dbStore.getData();
    const bizId = ctx.business.id;

    const products = visibleProducts(data, ctx);
    const productIds = new Set(products.map((p) => p.id));

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: ctx.user,
      business: ctx.business,
      connections: Object.values(data.connections).filter(
        (c) => c.wholesalerId === bizId || c.retailerId === bizId
      ),
      products: ctx.user.role === 'wholesaler' ? products : [],
      priceHistory: Object.values(data.priceHistory).filter((h) => productIds.has(h.productId)),
      inventory: Object.values(data.inventory).filter((i) => i.retailerId === bizId),
      purchaseHistory: Object.values(data.purchaseHistory).filter((p) => p.retailerId === bizId),
      orders: Object.values(data.orders).filter((o) => o.retailerId === bizId || o.wholesalerId === bizId),
      sales: Object.values(data.sales).filter((s) => s.sellerId === bizId),
      notifications: Object.values(data.notifications).filter((n) => n.recipientId === bizId),
    };

    return json(exportData);
  } catch (e) {
    return handleError(e);
  }
}
