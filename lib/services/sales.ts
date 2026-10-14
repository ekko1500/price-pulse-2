import { DatabaseSchema } from '../seed/demo';
import { Sale, SaleItem, SalePaymentMethod } from '../types';
import { AuthContext } from '../auth/session';
import { makeId } from '../util/id';
import { createNotification, recordAudit } from './events';

export class SaleError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const PAYMENT_METHODS: SalePaymentMethod[] = [
  'cash',
  'kbzpay',
  'wavepay',
  'bank_transfer',
  'credit',
];

function isAllowedPayment(value: unknown): value is SalePaymentMethod {
  return typeof value === 'string' && (PAYMENT_METHODS as string[]).includes(value);
}

export interface CreateSaleInput {
  items: Array<{ productId: string; quantity: number }>;
  customerName?: string;
  customerPhone?: string;
  discount?: number;
  paymentMethod?: SalePaymentMethod;
  amountPaid?: number;
  notes?: string;
}

function zeroIfInvalid(n: unknown, fallback = 0): number {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) && v >= 0 ? Math.round(v) : fallback;
}

function receiptNumberForToday(data: DatabaseSchema, nowISO: string): string {
  const day = nowISO.slice(0, 10).replace(/-/g, '');
  const todayCount = Object.values(data.sales).filter((s) => s.soldAt.slice(0, 10) === nowISO.slice(0, 10)).length;
  return `RCPT-${day}-${String(todayCount + 1).padStart(3, '0')}`;
}

/**
 * The ONLY place inventory / wholesale stock decreases.
 *
 * Retailer channel sells the retailer's own inventory at its selling price and
 * captures cost for margin reporting. Wholesaler channel sells the wholesaler's
 * catalog at wholesale prices; stock is decremented when the product was seeded
 * with stockQuantity (otherwise it is treated as untracked).
 */
export function createSale(data: DatabaseSchema, ctx: AuthContext, input: CreateSaleInput): Sale {
  const nowISO = new Date().toISOString();
  const discount = zeroIfInvalid(input.discount);
  const amountPaid = zeroIfInvalid(input.amountPaid);
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new SaleError('EMPTY_CART', 'Add at least one item to make a sale.', 422);
  }
  if (!isAllowedPayment(input.paymentMethod)) {
    throw new SaleError('VALIDATION', 'Choose a valid payment method.', 422);
  }

  const isRetailer = ctx.user.role === 'retailer';
  const sellerRole = isRetailer ? 'retailer' : ctx.user.role === 'wholesaler' ? 'wholesaler' : null;
  if (!sellerRole) {
    throw new SaleError('FORBIDDEN', 'Only retailers and wholesalers can use the POS.', 403);
  }

  // Phase 1: validate + snapshot every line BEFORE mutating stock.
  const items: SaleItem[] = [];
  const stockMutations: Array<{ apply: () => void }> = [];
  const lowStockNotice: Array<{ name: string }> = [];

  for (const raw of input.items) {
    const productId = typeof raw?.productId === 'string' ? raw.productId : '';
    const quantity = Number(raw?.quantity);
    if (!productId) throw new SaleError('VALIDATION', 'Every line needs a product.', 422);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      throw new SaleError('VALIDATION', 'Quantity must be a positive whole number.', 422);
    }

    if (isRetailer) {
      const inv = data.inventory[productId];
      if (!inv || inv.retailerId !== ctx.business.id) {
        throw new SaleError('NOT_FOUND', `"${productId}" is not in your inventory.`, 404);
      }
      if (quantity > inv.currentStock) {
        throw new SaleError('OUT_OF_STOCK', `Not enough stock of "${inv.name}" (have ${inv.currentStock}).`, 409);
      }
      const lineTotal = quantity * inv.currentSellingPrice;
      items.push({
        productId: inv.id,
        name: inv.name,
        unit: inv.unit || 'piece',
        quantity,
        unitPrice: inv.currentSellingPrice,
        unitCost: inv.lastSupplierCost > 0 ? inv.lastSupplierCost : undefined,
        lineTotal,
      });
      stockMutations.push({
        apply: () => {
          inv.currentStock -= quantity;
          inv.lastUpdated = nowISO;
          data.inventory[inv.id] = inv;
        },
      });
      if (inv.currentStock - quantity <= inv.lowStockThreshold) lowStockNotice.push({ name: inv.name });
    } else {
      const product = data.products[productId];
      if (!product || product.wholesalerId !== ctx.business.id || !product.isActive) {
        throw new SaleError('NOT_FOUND', `"${productId}" is not an active product in your catalog.`, 404);
      }
      if (typeof product.stockQuantity === 'number' && quantity > product.stockQuantity) {
        throw new SaleError('OUT_OF_STOCK', `Not enough stock of "${product.name}" (have ${product.stockQuantity}).`, 409);
      }
      const lineTotal = quantity * product.currentPrice;
      items.push({
        productId: product.id,
        name: `${product.name}${product.packageSize ? ' ' + product.packageSize : ''}`,
        unit: product.unit,
        quantity,
        unitPrice: product.currentPrice,
        lineTotal,
      });
      if (typeof product.stockQuantity === 'number') {
        stockMutations.push({
          apply: () => {
            product.stockQuantity = (product.stockQuantity ?? 0) - quantity;
            product.lastUpdated = nowISO;
            data.products[product.id] = product;
          },
        });
      }
    }
  }

  // Phase 2: compute money and authorise payment.
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  if (discount > subtotal) {
    throw new SaleError('VALIDATION', 'Discount cannot exceed the subtotal.', 422);
  }
  const total = subtotal - discount;
  const isCredit = input.paymentMethod === 'credit';
  const isCash = input.paymentMethod === 'cash';
  // Non-cash, non-credit methods (mobile money / bank transfer) settle in full
  // when no explicit amount is supplied.
  let paid = amountPaid;
  if (!isCredit && !isCash && paid === 0) paid = total;
  if (!isCredit && paid < total) {
    throw new SaleError('PARTIAL_PAYMENT', `Amount paid (${paid} MMK) does not cover the total (${total} MMK).`, 422);
  }
  const changeDue = paid > total ? paid - total : 0;

  // Phase 3: apply stock mutations.
  for (const m of stockMutations) m.apply();

  const sale: Sale = {
    id: makeId('sale'),
    receiptNumber: receiptNumberForToday(data, nowISO),
    sellerId: ctx.business.id,
    sellerName: ctx.business.name,
    sellerRole: sellerRole as 'retailer' | 'wholesaler',
    channel: isRetailer ? 'retail' : 'wholesale',
    customerName: input.customerName || undefined,
    customerPhone: input.customerPhone || undefined,
    items,
    subtotal,
    discount,
    total,
    paymentMethod: input.paymentMethod as SalePaymentMethod,
    amountPaid: paid,
    changeDue,
    status: 'completed',
    notes: input.notes || undefined,
    soldBy: ctx.user.id,
    soldAt: nowISO,
    isDemo: ctx.isDemo,
  };
  data.sales[sale.id] = sale;

  recordAudit(data, {
    actorId: ctx.user.id,
    actorName: ctx.business.name,
    actorRole: ctx.user.role,
    action: 'SALE_CREATED',
    targetType: 'SALE',
    targetId: sale.id,
    details: { receiptNumber: sale.receiptNumber, total, items: items.length },
    isDemo: ctx.isDemo,
  });

  if (lowStockNotice.length > 0) {
    createNotification(data, {
      recipientId: ctx.business.id,
      title: 'Low stock after sale',
      body: lowStockNotice.map((l) => l.name).join(', '),
      type: 'low_stock',
      dedupeKey: `sale_low_stock:${sale.id}`,
      isDemo: ctx.isDemo,
    });
  }

  return sale;
}

/**
 * Void a completed sale. The seller (or an admin) may void it; stock that was
 * decremented is restored so the books stay consistent. Idempotent-safe: a
 * second void fails with 409 but changes nothing.
 */
export function voidSale(data: DatabaseSchema, ctx: AuthContext, saleId: string): Sale {
  const sale = data.sales[saleId];
  if (!sale) throw new SaleError('NOT_FOUND', 'Sale not found.', 404);
  if (sale.status === 'voided') throw new SaleError('ALREADY_VOIDED', 'This sale is already voided.', 409);
  if (sale.sellerId !== ctx.business.id && ctx.user.role !== 'admin') {
    throw new SaleError('FORBIDDEN', 'You are not the seller of this sale.', 403);
  }

  const nowISO = new Date().toISOString();
  for (const item of sale.items) {
    if (sale.sellerRole === 'retailer') {
      const inv = data.inventory[item.productId];
      if (inv && inv.retailerId === sale.sellerId) {
        inv.currentStock += item.quantity;
        inv.lastUpdated = nowISO;
        data.inventory[inv.id] = inv;
      } else {
        // Restore by name-only match if the item link was lost.
        const match = Object.values(data.inventory).find(
          (i) => i.retailerId === sale.sellerId && i.name.toLowerCase() === item.name.toLowerCase()
        );
        if (match) {
          match.currentStock += item.quantity;
          match.lastUpdated = nowISO;
          data.inventory[match.id] = match;
        }
      }
    } else {
      const product = data.products[item.productId];
      if (product && product.wholesalerId === sale.sellerId && typeof product.stockQuantity === 'number') {
        product.stockQuantity += item.quantity;
        product.lastUpdated = nowISO;
        data.products[product.id] = product;
      }
    }
  }

  sale.status = 'voided';
  sale.voidedAt = nowISO;
  sale.voidedBy = ctx.user.id;
  data.sales[sale.id] = sale;

  recordAudit(data, {
    actorId: ctx.user.id,
    actorName: ctx.business.name,
    actorRole: ctx.user.role,
    action: 'SALE_VOIDED',
    targetType: 'SALE',
    targetId: sale.id,
    details: { receiptNumber: sale.receiptNumber },
    isDemo: ctx.isDemo,
  });

  return sale;
}