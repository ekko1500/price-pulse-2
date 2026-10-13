import { describe, it, expect } from 'vitest';
import { freshData, ctxFor, stockOf } from './helpers';
import { confirmReceipt, transitionOrder, OrderError } from '@/lib/services/orders';
import { createNotification } from '@/lib/services/events';

describe('confirmReceipt idempotency', () => {
  it('increases stock exactly once and records purchase history', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-retailer-1');
    const oilBefore = stockOf(data, 'inv-ret1-oil');
    const riceBefore = stockOf(data, 'inv-ret1-rice');
    const purchasesBefore = Object.keys(data.purchaseHistory).length;

    const order = confirmReceipt(data, ctx, 'ord-demo-1');
    expect(order.status).toBe('receipt_confirmed');
    expect(stockOf(data, 'inv-ret1-oil')).toBe(oilBefore + 24);
    expect(stockOf(data, 'inv-ret1-rice')).toBe(riceBefore + 10);
    expect(Object.keys(data.purchaseHistory).length).toBe(purchasesBefore + 2);
  });

  it('a second confirmation fails with 409 and adds NO stock', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-retailer-1');
    confirmReceipt(data, ctx, 'ord-demo-1');
    const snapshot = { oil: stockOf(data, 'inv-ret1-oil'), rice: stockOf(data, 'inv-ret1-rice'), purchases: Object.keys(data.purchaseHistory).length };

    let thrown: unknown;
    try {
      confirmReceipt(data, ctx, 'ord-demo-1');
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(OrderError);
    expect((thrown as OrderError).status).toBe(409);
    expect((thrown as OrderError).code).toBe('ALREADY_CONFIRMED');
    expect(stockOf(data, 'inv-ret1-oil')).toBe(snapshot.oil);
    expect(stockOf(data, 'inv-ret1-rice')).toBe(snapshot.rice);
    expect(Object.keys(data.purchaseHistory).length).toBe(snapshot.purchases);
  });

  it('refuses confirmation by a non-party retailer', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-retailer-2');
    expect(() => confirmReceipt(data, ctx, 'ord-demo-1')).toThrow(OrderError);
  });
});

describe('transitionOrder guards', () => {
  it('blocks the receipt_confirmed transition (must use receipt endpoint)', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-retailer-1');
    expect(() => transitionOrder(data, ctx, 'ord-demo-1', 'receipt_confirmed')).toThrow(/receipt endpoint/i);
  });

  it('blocks a wholesaler from a retailer-only transition', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-wholesaler-1');
    expect(() => transitionOrder(data, ctx, 'ord-demo-1', 'receipt_confirmed')).toThrow(OrderError);
    expect(data.orders['ord-demo-1'].status).toBe('delivered');
  });

  it('allows a valid wholesaler transition (pending -> accepted)', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-wholesaler-2');
    const order = transitionOrder(data, ctx, 'ord-demo-2', 'accepted');
    expect(order.status).toBe('accepted');
  });

  it('rejects an invalid transition', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-wholesaler-2');
    expect(() => transitionOrder(data, ctx, 'ord-demo-2', 'delivered')).toThrow(OrderError);
  });
});

describe('notification de-duplication', () => {
  it('same recipient + dedupeKey creates only one notification', () => {
    const data = freshData();
    const first = createNotification(data, { recipientId: 'biz-retailer-1', title: 't', body: 'b', type: 'price_change', dedupeKey: 'k1' });
    const second = createNotification(data, { recipientId: 'biz-retailer-1', title: 't', body: 'b', type: 'price_change', dedupeKey: 'k1' });
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });
});
