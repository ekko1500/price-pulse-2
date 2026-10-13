import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { hasActiveConnection } from '@/lib/auth/rbac';
import { Order, OrderItem } from '@/lib/types';
import { makeId } from '@/lib/util/id';
import { recordAudit, createNotification } from '@/lib/services/events';
import { cleanString } from '@/lib/validation';

interface RawItem {
  productId?: unknown;
  quantity?: unknown;
}

/** Retailer places an order with an actively connected wholesaler. */
export async function POST(req: NextRequest) {
  try {
    const g = guard(req, ['retailer']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);
    const wholesalerId = cleanString(body.wholesalerId);
    const rawItems = Array.isArray(body.items) ? (body.items as RawItem[]) : [];

    if (!wholesalerId) return fail('VALIDATION', 'Choose a wholesaler.', 422);
    if (rawItems.length === 0) return fail('VALIDATION', 'Add at least one product.', 422);

    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const wholesaler = data.businesses[wholesalerId];
      if (!wholesaler || wholesaler.role !== 'wholesaler') return fail('NOT_FOUND', 'Wholesaler not found.', 404);
      if (!hasActiveConnection(data, ctx.business.id, wholesalerId)) {
        return fail('NOT_CONNECTED', 'You are not actively connected to this wholesaler.', 403);
      }

      const items: OrderItem[] = [];
      for (const raw of rawItems) {
        const productId = cleanString(raw.productId);
        const qty = Number(raw.quantity);
        const product = data.products[productId];
        if (!product || product.wholesalerId !== wholesalerId || !product.isActive) {
          return fail('VALIDATION', `Product ${productId || '(unknown)'} is not available from this wholesaler.`, 422);
        }
        if (!Number.isFinite(qty) || qty <= 0) return fail('VALIDATION', 'Quantity must be positive.', 422);
        // price snapshot at order time
        items.push({
          productId: product.id,
          productName: `${product.name}${product.packageSize ? ' ' + product.packageSize : ''}`,
          unit: product.unit,
          quantity: Math.round(qty),
          agreedUnitPrice: product.currentPrice,
          lineTotal: Math.round(qty) * product.currentPrice,
        });
      }

      const nowISO = new Date().toISOString();
      const totalAmount = items.reduce((s, i) => s + i.lineTotal, 0);
      const order: Order = {
        id: makeId('ord'),
        orderNumber: `ORD-${nowISO.slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000 + 1000)}`,
        retailerId: ctx.business.id,
        retailerName: ctx.business.name,
        wholesalerId,
        wholesalerName: wholesaler.name,
        items,
        totalAmount,
        status: 'pending',
        paymentStatus: 'unpaid',
        paidAmount: 0,
        notes: cleanString(body.notes) || undefined,
        placedAt: nowISO,
        updatedAt: nowISO,
        isDemo: ctx.isDemo,
      };
      data.orders[order.id] = order;

      createNotification(data, {
        recipientId: wholesalerId,
        title: `New order ${order.orderNumber}`,
        body: `${ctx.business.name} placed an order for ${items.length} item(s), total ${totalAmount.toLocaleString()} MMK.`,
        type: 'order_update',
        link: '/wholesaler/orders',
        dedupeKey: `order:new:${order.id}`,
        isDemo: ctx.isDemo,
      });
      recordAudit(data, {
        actorId: ctx.user.id, actorName: ctx.business.name, actorRole: ctx.user.role,
        action: 'ORDER_PLACED', targetType: 'ORDER', targetId: order.id,
        details: { totalAmount, items: items.length }, isDemo: ctx.isDemo,
      });
      return json({ order }, 201);
    });
  } catch (e) {
    return handleError(e);
  }
}
