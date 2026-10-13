import { NextRequest } from 'next/server';
import { dbStore, persistenceMode } from '@/lib/db/store';
import { guard, json, handleError } from '@/lib/api/http';
import { visibleProducts } from '@/lib/auth/rbac';

/**
 * Role-scoped application snapshot. This is the ONLY bulk read endpoint and it
 * returns strictly the records the caller is authorized to see. There is no
 * endpoint that returns the whole database.
 */
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const g = guard(req);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const data = dbStore.getData();
    const bizId = ctx.business.id;
    const role = ctx.user.role;

    const connections = Object.values(data.connections).filter((c) => {
      if (role === 'admin') return true;
      if (role === 'wholesaler') return c.wholesalerId === bizId;
      return c.retailerId === bizId;
    });

    const products = visibleProducts(data, ctx);
    const productIds = new Set(products.map((p) => p.id));

    const anyProductIds = role === 'admin';
    const priceHistory = Object.values(data.priceHistory).filter((h) =>
      anyProductIds ? true : productIds.has(h.productId)
    );

    const inventory = role === 'admin'
      ? Object.values(data.inventory)
      : role === 'retailer'
        ? Object.values(data.inventory).filter((i) => i.retailerId === bizId)
        : [];

    const purchaseHistory = role === 'retailer' || role === 'admin'
      ? Object.values(data.purchaseHistory).filter((p) => role === 'admin' || p.retailerId === bizId)
      : [];

    const orders = Object.values(data.orders).filter((o) => {
      if (role === 'admin') return true;
      return o.retailerId === bizId || o.wholesalerId === bizId;
    });

    const notifications = Object.values(data.notifications).filter((n) => n.recipientId === bizId);

    const drafts = role === 'admin'
      ? Object.values(data.drafts)
      : role === 'wholesaler'
        ? Object.values(data.drafts).filter((d) => d.wholesalerId === bizId)
        : [];

    const auditLogs = role === 'admin' ? Object.values(data.auditLogs) : [];

    // Public business directory (used for connection requests). No prices included.
    const directory = Object.values(data.businesses)
      .filter((b) => b.role === 'wholesaler' && b.id !== bizId)
      .map((b) => ({ id: b.id, name: b.name, city: b.city, role: b.role }));

    return json({
      user: ctx.user,
      business: ctx.business,
      isDemo: ctx.isDemo,
      persistenceMode: persistenceMode(),
      connections,
      products,
      priceHistory,
      inventory,
      purchaseHistory,
      orders,
      notifications,
      drafts,
      auditLogs,
      directory,
    });
  } catch (e) {
    return handleError(e);
  }
}
