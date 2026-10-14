/**
 * PricePulse Myanmar - domain types
 * Currency is MMK everywhere unless stated otherwise.
 */

export type UserRole = 'retailer' | 'wholesaler' | 'admin';

export interface User {
  id: string;
  username: string;
  /** scrypt password hash, hex. Never exposed to clients. */
  passwordHash: string;
  /** random per-user salt, hex. Never exposed to clients. */
  passwordSalt: string;
  phoneNumber: string;
  role: UserRole;
  businessId: string;
  isActive: boolean;
  isDemo: boolean;
  createdAt: string;
  /** administrator-assisted reset token (hash only). Never a password. */
  resetTokenHash?: string;
  resetTokenSalt?: string;
  resetTokenExpiresAt?: string;
}

/** User object safe to return to the browser (no credentials). */
export type PublicUser = Omit<User, 'passwordHash' | 'passwordSalt'>;

export interface Business {
  id: string;
  name: string;
  ownerId: string;
  role: UserRole;
  phoneNumber: string;
  address?: string;
  city?: string;
  createdAt: string;
  isDemo: boolean;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  /** for basic audit: which demo/business the session belongs to */
  isDemo: boolean;
}

export type ConnectionStatus = 'pending' | 'active' | 'rejected' | 'suspended';

export interface SupplierConnection {
  id: string;
  wholesalerId: string;
  wholesalerName: string;
  retailerId: string;
  retailerName: string;
  status: ConnectionStatus;
  requestedAt: string;
  respondedAt?: string;
  isDemo: boolean;
}

export const PRODUCT_UNITS = [
  'piece',
  'bottle',
  'pack',
  'box',
  'bag',
  'tin',
  'can',
  'kg',
  'g',
  'liter',
  'ml',
] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export interface SupplierProduct {
  id: string;
  wholesalerId: string;
  name: string;
  brand?: string;
  category: string;
  packageSize?: string;
  unit: ProductUnit;
  description?: string;
  isActive: boolean;
  /** current supplier-specific wholesale price in MMK */
  currentPrice: number;
  /**
   * Optional wholesale stock on hand. When undefined the product is treated as
   * untracked (the wholesale POS records sales without decrementing stock).
   */
  stockQuantity?: number;
  /** Denormalised URL of the centralised active reference thumbnail. */
  activeThumbnailUrl?: string;
  lastUpdated: string;
  isDemo: boolean;
}

export type PriceSourceType = 'manual' | 'gemini_extraction' | 'csv_import';

export interface PriceHistoryRecord {
  id: string;
  productId: string;
  productName: string;
  wholesalerId: string;
  oldPrice: number;
  newPrice: number;
  changeMMK: number;
  changePercentage: number;
  effectiveDate: string;
  updatedBy: string;
  sourceType: PriceSourceType;
  sourceMessage?: string;
  /** id of the confirmed draft that produced this record, if any */
  confirmedDraftId?: string;
  timestamp: string;
  isDemo: boolean;
}

export interface RetailerInventoryItem {
  id: string;
  retailerId: string;
  /** optional link to a supplier product it was sourced from */
  supplierProductId?: string;
  name: string;
  category: string;
  unit: string;
  packageSize?: string;
  currentStock: number;
  lowStockThreshold: number;
  expiryDate?: string;
  currentSellingPrice: number;
  /** last known cost from the linked/primary supplier (per unit) */
  lastSupplierCost: number;
  primaryWholesalerId?: string;
  primaryWholesalerName?: string;
  /** Denormalised URL of the centralised active reference thumbnail. */
  activeThumbnailUrl?: string;
  lastUpdated: string;
  isDemo: boolean;
}

export interface PurchaseHistoryRecord {
  id: string;
  retailerId: string;
  inventoryItemId: string;
  wholesalerId?: string;
  wholesalerName?: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  orderId?: string;
  receivedAt: string;
  receivedBy: string;
  isDemo: boolean;
}

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'receipt_confirmed'
  | 'rejected'
  | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

export interface OrderItem {
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  agreedUnitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  retailerId: string;
  retailerName: string;
  wholesalerId: string;
  wholesalerName: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  notes?: string;
  placedAt: string;
  updatedAt: string;
  receiptConfirmedAt?: string;
  receiptConfirmedBy?: string;
  isDemo: boolean;
}

/**
 * Point-of-sale (POS) selling.
 * A retailer sells its own inventory to walk-in customers; a wholesaler sells
 * its catalog to walk-in / go-down customers. Currency is MMK.
 */
export type SaleChannel = 'retail' | 'wholesale';
export type SalePaymentMethod = 'cash' | 'kbzpay' | 'wavepay' | 'bank_transfer' | 'credit';
export type SaleStatus = 'completed' | 'voided';

export interface SaleItem {
  /** Inventory item id (retailer) or supplier product id (wholesaler). */
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  /** price per unit captured at the moment of sale */
  unitPrice: number;
  /** cost per unit captured at the moment of sale (retailer only) */
  unitCost?: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  /** selling business (retailer or wholesaler) */
  sellerId: string;
  sellerName: string;
  sellerRole: 'retailer' | 'wholesaler';
  channel: SaleChannel;
  customerName?: string;
  customerPhone?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: SalePaymentMethod;
  amountPaid: number;
  changeDue: number;
  status: SaleStatus;
  notes?: string;
  soldBy: string;
  soldAt: string;
  voidedAt?: string;
  voidedBy?: string;
  isDemo: boolean;
}

/**
 * Centralised reference thumbnails.
 *
 * Thumbnails are shared across the whole system (not per business) and keyed by
 * a normalised item name so the same goods show the same picture everywhere.
 * Users vote on the active picture; when it accumulates enough downvotes they
 * may submit a better one (bounded per user and per item).
 */
export type ThumbnailStatus = 'active' | 'suggested' | 'archived';

export interface ThumbnailModeration {
  status: 'approved' | 'rejected' | 'unchecked';
  reason?: string;
  model?: string;
  confidence?: number;
  checkedAt: string;
}

export interface ItemThumbnail {
  id: string;
  /** normalised item key (see normalizeItemKey) */
  itemKey: string;
  /** human-readable item label at submission time */
  label: string;
  /** public image URL (Firebase Storage, or an inline data URL in local dev) */
  url: string;
  /** storage object path, used to delete the object when replaced */
  storagePath?: string;
  status: ThumbnailStatus;
  submittedBy: string;
  submittedByName: string;
  upvotes: number;
  downvotes: number;
  /** AI-suggested category for the item (see smart tagging). */
  category?: string;
  /** AI-extracted descriptive tags. */
  tags?: string[];
  /** Outcome of Gemini image moderation. */
  moderation?: ThumbnailModeration;
  createdAt: string;
  promotedAt?: string;
  isDemo: boolean;
}

export interface ThumbnailVote {
  id: string;
  thumbnailId: string;
  itemKey: string;
  userId: string;
  /** +1 up, -1 down */
  value: 1 | -1;
  createdAt: string;
  isDemo: boolean;
}

export type NotificationType =
  | 'price_change'
  | 'connection_request'
  | 'connection_decision'
  | 'order_update'
  | 'low_stock'
  | 'expiry_alert';

export interface InAppNotification {
  id: string;
  recipientId: string;
  title: string;
  body: string;
  type: NotificationType;
  link?: string;
  data?: Record<string, unknown>;
  read: boolean;
  /** de-duplication key: same key + recipient will not create a second notification */
  dedupeKey?: string;
  createdAt: string;
  isDemo: boolean;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole | 'system';
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
  timestamp: string;
  isDemo: boolean;
}

/** A price update draft produced by extraction/import/manual capture, pending review. */
export type DraftStatus = 'pending' | 'confirmed' | 'rejected';

export interface PriceUpdateDraft {
  id: string;
  wholesalerId: string;
  productId?: string;
  productName: string;
  brand?: string;
  packageSize?: string;
  unit: string;
  previousPrice?: number;
  newPrice: number;
  currency: 'MMK';
  effectiveDate?: string;
  confidence: number;
  missingFields: string[];
  warnings: string[];
  notes?: string;
  sourceType: PriceSourceType;
  rawMessage?: string;
  candidateProductIds: string[];
  status: DraftStatus;
  createdBy: string;
  createdAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
  publishedHistoryId?: string;
  isDemo: boolean;
}

/** Output of extraction BEFORE persistence (no id/status yet). */
export interface ExtractedPriceDraft {
  productName: string;
  brand?: string;
  packageSize?: string;
  unit: string;
  previousPrice?: number;
  newPrice: number;
  currency: 'MMK';
  effectiveDate?: string;
  confidence: number;
  missingFields: string[];
  warnings: string[];
  notes?: string;
  rawMessage: string;
  candidateProductIds: string[];
}

export interface DemoMetadata {
  initializedAt: string;
  demoBusinessIds: string[];
  demoUserIds: string[];
}
