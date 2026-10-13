import { DatabaseSchema } from '../seed/demo';
import { Order, OrderStatus, PurchaseHistoryRecord, RetailerInventoryItem } from '../types';
import { AuthContext } from '../auth/session';
import { makeId } from '../util/id';
import { recordAudit, createNotification } from './events';

export class OrderError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered'],
  delivered: ['receipt_confirmed'],
  receipt_confirmed: [],
  rejected: [],
  cancelled: [],
};

const WHOLESALER_TARGETS: OrderStatus[] = ['accepted', 'rejected', 'preparing', 'ready', 'delivered', 'cancelled'];
const RETAILER_TARGETS: OrderStatus[] = ['cancelled', 'receipt_confirmed'];

export function canTransition(order: Order, target: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[order.status]?.includes(target) ?? false;
}

/**
 * Change an order's status with role + transition validation.
 * Stock is NEVER touched here - see confirmReceipt.
 */
export function transitionOrder(
  data: DatabaseSchema,
  ctx: AuthContext,
  orderId: string,
  target: OrderStatus,
): Order {
  const order = data.orders[orderId];
  if (!order) throw new OrderError('NOT_FOUND', 'Order not found.', 404);

  const isRetailer = ctx.business.id === order.retailerId;
  const isWholesaler = ctx.business.id === order.wholesalerId;
  const isAdmin = ctx.user.role === 'admin';

  if (!isRetailer && !isWholesaler && !isAdmin) {
    throw new OrderError('FORBIDDEN', 'You are not a party to this order.', 403);
  }
  if (!canTransition(order, target)) {
    throw new OrderError('INVALID_TRANSITION', `Cannot change status from ${order.status} to ${target}.`, 409);
  }
  if (isWholesaler && !WHOLESALER_TARGETS.includes(target)) {
    throw new OrderError('FORBIDDEN', 'Wholesalers cannot perform this transition.', 403);
  }
  if (isRetailer && !RETAILER_TARGETS.includes(target)) {
    throw new OrderError('FORBIDDEN', 'Retailers cannot perform this transition.', 403);
  }
  if (target === 'receipt_confirmed') {
    throw new OrderError('USE_RECEIPT_ENDPOINT', 'Confirm receipt via the receipt endpoint.', 400);
  }

  order.status = target;
  order.updatedAt = new Date().toISOString();
  data.orders[order.id] = order;

  recordAudit(data, {
    actorId: ctx.user.id,
    actorName: ctx.business.name,
    actorRole: ctx.user.role,
    action: 'ORDER_STATUS_CHANGED',
    targetType: 'ORDER',
    targetId: order.id,
    details: { to: target },
    isDemo: ctx.isDemo,
  });

  // Notify the counterparty.
  const otherParty = ctx.user.role === 'retailer' ? order.wholesalerId : order.retailerId;
  if (otherParty) {
    createNotification(data, {
      recipientId: otherParty,
      title: `Order ${order.orderNumber} ${target.replace('_', ' ')}`,
      body: `Order status is now "${target.replace('_', ' ')}".`,
      type: 'order_update',
      link: '/orders',
      dedupeKey: `order:${order.id}:${target}`,
      isDemo: ctx.isDemo,
    });
  }
  return order;
}

/**
 * The ONLY place retailer stock increases.
 * - Only the authorized retailer may confirm.
 * - Idempotent: a second confirmation fails with 409 and adds no stock.
 * - Adds a purchase-history row per item with the agreed unit price snapshot.
 */
export function confirmReceipt(data: DatabaseSchema, ctx: AuthContext, orderId: string): Order {
  if (ctx.user.role !== 'retailer') {
    throw new OrderError('FORBIDDEN', 'Only the purchasing retailer can confirm receipt.', 403);
  }
  const order = data.orders[orderId];
  if (!order) throw new OrderError('NOT_FOUND', 'Order not found.', 404);
  if (order.retailerId !== ctx.business.id) {
    throw new OrderError('FORBIDDEN', 'This order does not belong to your business.', 403);
  }
  if (order.receiptConfirmedAt) {
    throw new OrderError('ALREADY_CONFIRMED', 'Receipt has already been confirmed for this order.', 409);
  }
  if (!['delivered', 'ready'].includes(order.status)) {
    throw new OrderError('INVALID_STATE', 'Only delivered or ready orders can be received.', 409);
  }

  const nowISO = new Date().toISOString();

  for (const item of order.items) {
    // Locate a matching inventory item by supplier product link, else by name.
    let inv = Object.values(data.inventory).find(
      (i) => i.retailerId === ctx.business.id && i.supplierProductId === item.productId
    );
    if (!inv) {
      inv = Object.values(data.inventory).find(
        (i) => i.retailerId === ctx.business.id && i.name.toLowerCase() === item.productName.toLowerCase()
      );
    }

    if (!inv) {
      const newItem: RetailerInventoryItem = {
        id: makeId('inv'),
        retailerId: ctx.business.id,
        supplierProductId: item.productId,
        name: item.productName,
        category: 'Uncategorised',
        unit: item.unit,
        currentStock: 0,
        lowStockThreshold: 10,
        currentSellingPrice: 0,
        lastSupplierCost: item.agreedUnitPrice,
        primaryWholesalerId: order.wholesalerId,
        primaryWholesalerName: order.wholesalerName,
        lastUpdated: nowISO,
        isDemo: ctx.isDemo,
      };
      data.inventory[newItem.id] = newItem;
      inv = newItem;
    }

    inv.currentStock += item.quantity;
    inv.lastSupplierCost = item.agreedUnitPrice;
    inv.lastUpdated = nowISO;
    if (!inv.primaryWholesalerId) {
      inv.primaryWholesalerId = order.wholesalerId;
      inv.primaryWholesalerName = order.wholesalerName;
    }
    data.inventory[inv.id] = inv;

    const purchase: PurchaseHistoryRecord = {
      id: makeId('purchase'),
      retailerId: ctx.business.id,
      inventoryItemId: inv.id,
      wholesalerId: order.wholesalerId,
      wholesalerName: order.wholesalerName,
      quantity: item.quantity,
      unit: item.unit,
      unitCost: item.agreedUnitPrice,
      totalCost: item.lineTotal,
      orderId: order.id,
      receivedAt: nowISO,
      receivedBy: ctx.user.id,
      isDemo: ctx.isDemo,
    };
    data.purchaseHistory[purchase.id] = purchase;
  }

  order.status = 'receipt_confirmed';
  order.receiptConfirmedAt = nowISO;
  order.receiptConfirmedBy = ctx.user.id;
  order.updatedAt = nowISO;
  data.orders[order.id] = order;

  recordAudit(data, {
    actorId: ctx.user.id,
    actorName: ctx.business.name,
    actorRole: ctx.user.role,
    action: 'ORDER_RECEIPT_CONFIRMED',
    targetType: 'ORDER',
    targetId: order.id,
    details: { items: order.items.length },
    isDemo: ctx.isDemo,
  });

  createNotification(data, {
    recipientId: order.wholesalerId,
    title: `Order ${order.orderNumber} received`,
    body: `${order.retailerName} confirmed receipt of order ${order.orderNumber}.`,
    type: 'order_update',
    link: '/orders',
    dedupeKey: `order:${order.id}:receipt_confirmed`,
    isDemo: ctx.isDemo,
  });

  return order;
}
