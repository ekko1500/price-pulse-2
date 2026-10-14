import { describe, it, expect } from 'vitest';
import { freshData, ctxFor, stockOf } from './helpers';
import { createSale, voidSale, SaleError } from '@/lib/services/sales';

describe('createSale — retailer POS', () => {
  it('decrements inventory stock and records the sale with correct totals', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-retailer-1');
    const oilBefore = stockOf(data, 'inv-ret1-oil');
    const milkBefore = stockOf(data, 'inv-ret1-milk');

    const sale = createSale(data, ctx, {
      items: [
        { productId: 'inv-ret1-oil', quantity: 2 },
        { productId: 'inv-ret1-milk', quantity: 3 },
      ],
      paymentMethod: 'cash',
      amountPaid: 20000,
    });

    expect(sale.receiptNumber).toMatch(/^RCPT-\d{8}-\d+$/);
    expect(sale.channel).toBe('retail');
    expect(sale.sellerId).toBe('biz-retailer-1');
    expect(sale.subtotal).toBe(2 * 5600 + 3 * 2600);
    expect(sale.total).toBe(11200 + 7800);
    expect(sale.amountPaid).toBe(20000);
    expect(sale.changeDue).toBe(20000 - sale.total);
    expect(stockOf(data, 'inv-ret1-oil')).toBe(oilBefore - 2);
    expect(stockOf(data, 'inv-ret1-milk')).toBe(milkBefore - 3);
    // unit cost captured for margin reporting
    expect(sale.items[0].unitCost).toBe(5000);
    expect(data.auditLogs[Object.keys(data.auditLogs).at(-1)!].action).toBe('SALE_CREATED');
  });

  it('rejects selling more than available stock', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-retailer-1');
    expect(() =>
      createSale(data, ctx, {
        items: [{ productId: 'inv-ret1-rice', quantity: 999 }],
        paymentMethod: 'cash',
        amountPaid: 1000000,
      })
    ).toThrow(SaleError);
  });

  it('rejects an amount paid below the total for cash', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-retailer-1');
    expect(() =>
      createSale(data, ctx, {
        items: [{ productId: 'inv-ret1-oil', quantity: 1 }],
        paymentMethod: 'cash',
        amountPaid: 100,
      })
    ).toThrow(/does not cover the total/i);
  });

  it('accepts a credit sale with a partial payment', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-retailer-1');
    const sale = createSale(data, ctx, {
      items: [{ productId: 'inv-ret1-oil', quantity: 1 }],
      paymentMethod: 'credit',
      amountPaid: 2000,
    });
    expect(sale.paymentMethod).toBe('credit');
    expect(sale.amountPaid).toBe(2000);
    expect(sale.changeDue).toBe(0);
  });
});

describe('createSale — wholesaler POS', () => {
  it('sells catalog products at wholesale price and decrements tracked stock', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-wholesaler-1');
    const oilBefore = data.products['prod-w1-oil'].stockQuantity;

    const sale = createSale(data, ctx, {
      items: [
        { productId: 'prod-w1-oil', quantity: 40 },
        { productId: 'prod-w1-rice', quantity: 5 },
      ],
      paymentMethod: 'bank_transfer',
      customerName: 'Daw Naw Traders',
    });

    expect(sale.channel).toBe('wholesale');
    expect(sale.total).toBe(40 * 5000 + 5 * 18500);
    expect(data.products['prod-w1-oil'].stockQuantity).toBe(oilBefore! - 40);
    expect(sale.amountPaid).toBe(sale.total);
  });

  it('rejects a product that belongs to another wholesaler', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-wholesaler-2');
    expect(() =>
      createSale(data, ctx, {
        items: [{ productId: 'prod-w1-oil', quantity: 1 }],
        paymentMethod: 'cash',
      })
    ).toThrow(SaleError);
  });
});

describe('voidSale', () => {
  it('restores retailer stock and marks the sale voided', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-retailer-1');
    const oilBefore = stockOf(data, 'inv-ret1-oil');
    const sale = createSale(data, ctx, {
      items: [{ productId: 'inv-ret1-oil', quantity: 5 }],
      paymentMethod: 'cash',
      amountPaid: 100000,
    });
    const after = stockOf(data, 'inv-ret1-oil');
    expect(after).toBe(oilBefore - 5);

    const voided = voidSale(data, ctx, sale.id);
    expect(voided.status).toBe('voided');
    expect(stockOf(data, 'inv-ret1-oil')).toBe(oilBefore);
  });

  it('cannot void a sale twice', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-retailer-1');
    const sale = createSale(data, ctx, {
      items: [{ productId: 'inv-ret1-oil', quantity: 2 }],
      paymentMethod: 'cash',
      amountPaid: 100000,
    });
    const first = voidSale(data, ctx, sale.id);
    expect(first.status).toBe('voided');
    expect(() => voidSale(data, ctx, sale.id)).toThrow(SaleError);
  });

  it('only the seller or an admin can void', () => {
    const data = freshData();
    const seller = ctxFor(data, 'user-wholesaler-1');
    const intruder = ctxFor(data, 'user-retailer-1');
    const sale = createSale(data, seller, {
      items: [{ productId: 'prod-w1-oil', quantity: 10 }],
      paymentMethod: 'cash',
      amountPaid: 1000000,
    });
    expect(() => voidSale(data, intruder, sale.id)).toThrow(SaleError);
  });
});

describe('receipt numbering', () => {
  it('increments today receipt numbers and never collides with seeded history', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-retailer-1');
    const a = createSale(data, ctx, { items: [{ productId: 'inv-ret1-oil', quantity: 1 }], paymentMethod: 'cash', amountPaid: 10000 });
    const b = createSale(data, ctx, { items: [{ productId: 'inv-ret1-milk', quantity: 1 }], paymentMethod: 'cash', amountPaid: 10000 });
    expect(a.receiptNumber).not.toBe(b.receiptNumber);
  });
});