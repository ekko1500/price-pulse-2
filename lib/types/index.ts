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
  /** primary display name (kept for backward compatibility everywhere in the app) */
  name: string;
  brand?: string;
  category: string;
  packageSize?: string;
  unit: ProductUnit;
  description?: string;
  /** internal stock/item code, e.g. "BAT-777-AAA-4P" */
  itemId?: string;
  /** barcode / GTIN / supplier SKU */
  sku?: string;
  /** primary product name in English */
  nameEn?: string;
  /** primary product name in Burmese */
  nameMy?: string;
  /** everyday/colloquial Burmese name people actually use */
  colloquialNameMy?: string;
  /** free-form search keywords (Burmese and/or English) */
  searchKeywords?: string[];
  /** alternative names the product is known by */
  aliases?: string[];
  /** small compressed image as a data URL (image/*;base64). Kept tiny to fit the Firestore document cap. */
  imageData?: string;
  isActive: boolean;
  /** current supplier-specific wholesale price in MMK */
  currentPrice: number;
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
