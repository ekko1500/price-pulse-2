import { describe, it, expect } from 'vitest';
import { freshData, ctxFor, notificationsFor } from './helpers';
import { publishPriceChange, PricingError } from '@/lib/services/pricing';

describe('publishPriceChange', () => {
  it('updates exactly one product and appends an immutable history record', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-wholesaler-1');
    const product = data.products['prod-w1-oil'];
    const other = data.products['prod-w2-oil'];
    const otherPriceBefore = other.currentPrice;

    const result = publishPriceChange(data, {
      product,
      newPrice: 5800,
      sourceType: 'manual',
      actorUserId: ctx.user.id,
      isDemo: true,
    });

    expect(result.product.currentPrice).toBe(5800);
    expect(other.currentPrice).toBe(otherPriceBefore);
    expect(result.history.oldPrice).toBe(5000);
    expect(result.history.newPrice).toBe(5800);
    expect(result.history.changeMMK).toBe(800);
    expect(result.history.changePercentage).toBe(16);
    expect(Object.keys(data.priceHistory)).toContain(result.history.id);
  });

  it('notifies only actively connected retailers of that wholesaler', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-wholesaler-1');
    publishPriceChange(data, {
      product: data.products['prod-w1-oil'],
      newPrice: 5800,
      sourceType: 'manual',
      actorUserId: ctx.user.id,
      isDemo: true,
    });
    // retailer-1 (conn-1) and retailer-2 (conn-3) are active; nobody else.
    expect(notificationsFor(data, 'biz-retailer-1').some((n) => n.type === 'price_change')).toBe(true);
    expect(notificationsFor(data, 'biz-retailer-2').some((n) => n.type === 'price_change')).toBe(true);
    expect(notificationsFor(data, 'biz-retailer-2').filter((n) => n.type === 'price_change')).toHaveLength(1);
  });

  it('does not notify a retailer whose connection is only pending', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-wholesaler-2');
    publishPriceChange(data, {
      product: data.products['prod-w2-oil'],
      newPrice: 5400,
      sourceType: 'manual',
      actorUserId: ctx.user.id,
      isDemo: true,
    });
    // retailer-1 is actively connected to wholesaler-2; retailer-2 is only pending.
    expect(notificationsFor(data, 'biz-retailer-1').filter((n) => n.type === 'price_change')).toHaveLength(1);
    expect(notificationsFor(data, 'biz-retailer-2').filter((n) => n.type === 'price_change')).toHaveLength(0);
  });

  it('rejects a non-positive price', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-wholesaler-1');
    expect(() =>
      publishPriceChange(data, {
        product: data.products['prod-w1-oil'],
        newPrice: 0,
        sourceType: 'manual',
        actorUserId: ctx.user.id,
        isDemo: true,
      })
    ).toThrow(PricingError);
  });
});
