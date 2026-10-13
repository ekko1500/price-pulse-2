import { DatabaseSchema } from '../seed/demo';
import { PriceHistoryRecord, PriceSourceType, SupplierProduct } from '../types';
import { makeId } from '../util/id';
import { createNotification } from './events';
import { percentageChange } from '../calc/pricing';

export class PricingError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface PublishInput {
  product: SupplierProduct;
  newPrice: number;
  effectiveDate?: string;
  sourceType: PriceSourceType;
  sourceMessage?: string;
  confirmedDraftId?: string;
  actorUserId: string;
  isDemo: boolean;
}

export interface PublishResult {
  product: SupplierProduct;
  history: PriceHistoryRecord;
  notifiedBusinessIds: string[];
}

/**
 * Publish a confirmed wholesale price change for exactly ONE supplier product.
 * - Only touches the given supplier's product.
 * - Appends an immutable price-history record.
 * - Notifies only actively connected retailers.
 *
 * The caller is responsible for holding the store's exclusive lock.
 */
export function publishPriceChange(data: DatabaseSchema, input: PublishInput): PublishResult {
  const { product } = input;

  if (!Number.isFinite(input.newPrice) || input.newPrice <= 0) {
    throw new PricingError('INVALID_PRICE', 'Price must be a positive number.', 422);
  }

  const oldPrice = product.currentPrice;
  const nowISO = new Date().toISOString();
  const effectiveDate = input.effectiveDate || nowISO.split('T')[0];

  product.currentPrice = Math.round(input.newPrice);
  product.lastUpdated = nowISO;
  data.products[product.id] = product;

  const history: PriceHistoryRecord = {
    id: makeId('ph'),
    productId: product.id,
    productName: `${product.name}${product.packageSize ? ' ' + product.packageSize : ''}`,
    wholesalerId: product.wholesalerId,
    oldPrice,
    newPrice: product.currentPrice,
    changeMMK: product.currentPrice - oldPrice,
    changePercentage: percentageChange(oldPrice, product.currentPrice),
    effectiveDate,
    updatedBy: input.actorUserId,
    sourceType: input.sourceType,
    sourceMessage: input.sourceMessage,
    confirmedDraftId: input.confirmedDraftId,
    timestamp: nowISO,
    isDemo: input.isDemo,
  };
  data.priceHistory[history.id] = history;

  // Notify only actively connected retailers entitled to this product.
  const notified: string[] = [];
  const connected = Object.values(data.connections).filter(
    (c) => c.wholesalerId === product.wholesalerId && c.status === 'active'
  );
  const wholesalerName = data.businesses[product.wholesalerId]?.name ?? 'Supplier';
  for (const conn of connected) {
    const created = createNotification(data, {
      recipientId: conn.retailerId,
      title: `Price change: ${product.name}`,
      body: `${wholesalerName} updated ${product.name} from ${oldPrice.toLocaleString()} MMK to ${product.currentPrice.toLocaleString()} MMK (effective ${effectiveDate}).`,
      type: 'price_change',
      link: `/retailer/suppliers`,
      payload: { productId: product.id, historyId: history.id, oldPrice, newPrice: product.currentPrice },
      // one notification per event+recipient, so retries never duplicate
      dedupeKey: `price:${history.id}`,
      isDemo: input.isDemo,
    });
    if (created) notified.push(conn.retailerId);
  }

  return { product, history, notifiedBusinessIds: notified };
}
