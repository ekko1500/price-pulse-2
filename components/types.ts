import {
  AuditLog,
  Business,
  InAppNotification,
  Order,
  PriceHistoryRecord,
  PriceUpdateDraft,
  PublicUser,
  PurchaseHistoryRecord,
  RetailerInventoryItem,
  SupplierConnection,
  SupplierProduct,
} from '@/lib/types';

export interface DirectoryEntry {
  id: string;
  name: string;
  city?: string;
  role: string;
}

export interface BootstrapData {
  user: PublicUser;
  business: Business;
  isDemo: boolean;
  persistenceMode: string;
  connections: SupplierConnection[];
  products: SupplierProduct[];
  priceHistory: PriceHistoryRecord[];
  inventory: RetailerInventoryItem[];
  purchaseHistory: PurchaseHistoryRecord[];
  orders: Order[];
  notifications: InAppNotification[];
  drafts: PriceUpdateDraft[];
  auditLogs: AuditLog[];
  directory: DirectoryEntry[];
}
