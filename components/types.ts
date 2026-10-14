import {
  AuditLog,
  Business,
  InAppNotification,
  ItemThumbnail,
  Order,
  PriceHistoryRecord,
  PriceUpdateDraft,
  PublicUser,
  PurchaseHistoryRecord,
  RetailerInventoryItem,
  Sale,
  SupplierConnection,
  SupplierProduct,
  ThumbnailVote,
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
  sales: Sale[];
  notifications: InAppNotification[];
  drafts: PriceUpdateDraft[];
  auditLogs: AuditLog[];
  thumbnails: ItemThumbnail[];
  thumbnailVotes: ThumbnailVote[];
  directory: DirectoryEntry[];
}
