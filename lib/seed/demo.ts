import {
  AuditLog,
  Business,
  InAppNotification,
  ItemThumbnail,
  Order,
  PriceHistoryRecord,
  PriceUpdateDraft,
  PurchaseHistoryRecord,
  RetailerInventoryItem,
  Sale,
  Session,
  SupplierConnection,
  SupplierProduct,
  ThumbnailVote,
  User,
  DemoMetadata,
} from '../types';
import { hashPassword, DEMO_PASSWORDS } from '../auth/password';

export interface DatabaseSchema {
  users: Record<string, User>;
  businesses: Record<string, Business>;
  sessions: Record<string, Session>;
  connections: Record<string, SupplierConnection>;
  products: Record<string, SupplierProduct>;
  priceHistory: Record<string, PriceHistoryRecord>;
  inventory: Record<string, RetailerInventoryItem>;
  purchaseHistory: Record<string, PurchaseHistoryRecord>;
  orders: Record<string, Order>;
  sales: Record<string, Sale>;
  notifications: Record<string, InAppNotification>;
  drafts: Record<string, PriceUpdateDraft>;
  auditLogs: Record<string, AuditLog>;
  thumbnails: Record<string, ItemThumbnail>;
  thumbnailVotes: Record<string, ThumbnailVote>;
  meta: { demo?: DemoMetadata };
}

function demoUser(
  id: string,
  username: string,
  phoneNumber: string,
  role: User['role'],
  businessId: string,
  createdAt: string,
): User {
  const creds = hashPassword(DEMO_PASSWORDS[id] ?? 'Password#2026');
  return {
    id,
    username,
    phoneNumber,
    role,
    businessId,
    isActive: true,
    isDemo: true,
    createdAt,
    ...creds,
  };
}

/**
 * Builds a fresh, isolated demo dataset. All records carry isDemo: true and are
 * clearly illustrative (fictional businesses, fictional prices).
 */
export function buildDemoData(): DatabaseSchema {
  return {
    users: {
      'user-wholesaler-1': demoUser('user-wholesaler-1', 'aung_wholesale', '09791234567', 'wholesaler', 'biz-wholesaler-1', '2026-01-10T08:00:00Z'),
      'user-wholesaler-2': demoUser('user-wholesaler-2', 'mandalay_depot', '09797654321', 'wholesaler', 'biz-wholesaler-2', '2026-01-12T08:00:00Z'),
      'user-retailer-1': demoUser('user-retailer-1', 'shwe_store', '09421112233', 'retailer', 'biz-retailer-1', '2026-01-15T09:00:00Z'),
      'user-retailer-2': demoUser('user-retailer-2', 'kyaw_mini_mart', '09429998877', 'retailer', 'biz-retailer-2', '2026-01-16T09:00:00Z'),
      'user-admin': demoUser('user-admin', 'admin', '09990001122', 'admin', 'biz-admin', '2026-01-01T00:00:00Z'),
    },
    businesses: {
      'biz-wholesaler-1': {
        id: 'biz-wholesaler-1', name: 'Aung Wholesale Distribution (အောင် လက္ကား)', ownerId: 'user-wholesaler-1',
        role: 'wholesaler', phoneNumber: '09791234567', address: 'Bayintnaung Wholesale Market, Mayangone', city: 'Yangon',
        createdAt: '2026-01-10T08:00:00Z', isDemo: true,
      },
      'biz-wholesaler-2': {
        id: 'biz-wholesaler-2', name: 'Mandalay Commodity Depot (မန္တလေး ကုန်စည်ဒိုင်)', ownerId: 'user-wholesaler-2',
        role: 'wholesaler', phoneNumber: '09797654321', address: '84th Street, Chanayethazan', city: 'Mandalay',
        createdAt: '2026-01-12T08:00:00Z', isDemo: true,
      },
      'biz-retailer-1': {
        id: 'biz-retailer-1', name: 'Shwe Family Grocery Store (ရွှေမိသားစု ကုန်စုံဆိုင်)', ownerId: 'user-retailer-1',
        role: 'retailer', phoneNumber: '09421112233', address: 'Hledan Main Road, Kamayut', city: 'Yangon',
        createdAt: '2026-01-15T09:00:00Z', isDemo: true,
      },
      'biz-retailer-2': {
        id: 'biz-retailer-2', name: 'Kyaw Modern Mini Mart (ကျော် မီနီမတ်)', ownerId: 'user-retailer-2',
        role: 'retailer', phoneNumber: '09429998877', address: 'Insein Road, Hlaing', city: 'Yangon',
        createdAt: '2026-01-16T09:00:00Z', isDemo: true,
      },
      'biz-admin': {
        id: 'biz-admin', name: 'PricePulse Oversight Authority', ownerId: 'user-admin',
        role: 'admin', phoneNumber: '09990001122', city: 'Yangon', createdAt: '2026-01-01T00:00:00Z', isDemo: true,
      },
    },
    sessions: {},
    connections: {
      'conn-1': {
        id: 'conn-1', wholesalerId: 'biz-wholesaler-1', wholesalerName: 'Aung Wholesale Distribution (အောင် လက္ကား)',
        retailerId: 'biz-retailer-1', retailerName: 'Shwe Family Grocery Store (ရွှေမိသားစု ကုန်စုံဆိုင်)',
        status: 'active', requestedAt: '2026-01-15T10:00:00Z', respondedAt: '2026-01-15T10:30:00Z', isDemo: true,
      },
      'conn-2': {
        id: 'conn-2', wholesalerId: 'biz-wholesaler-2', wholesalerName: 'Mandalay Commodity Depot (မန္တလေး ကုန်စည်ဒိုင်)',
        retailerId: 'biz-retailer-1', retailerName: 'Shwe Family Grocery Store (ရွှေမိသားစု ကုန်စုံဆိုင်)',
        status: 'active', requestedAt: '2026-01-16T11:00:00Z', respondedAt: '2026-01-16T11:15:00Z', isDemo: true,
      },
      'conn-3': {
        id: 'conn-3', wholesalerId: 'biz-wholesaler-1', wholesalerName: 'Aung Wholesale Distribution (အောင် လက္ကား)',
        retailerId: 'biz-retailer-2', retailerName: 'Kyaw Modern Mini Mart (ကျော် မီနီမတ်)',
        status: 'active', requestedAt: '2026-01-17T09:00:00Z', respondedAt: '2026-01-17T09:20:00Z', isDemo: true,
      },
      'conn-4': {
        id: 'conn-4', wholesalerId: 'biz-wholesaler-2', wholesalerName: 'Mandalay Commodity Depot (မန္တလေး ကုန်စည်ဒိုင်)',
        retailerId: 'biz-retailer-2', retailerName: 'Kyaw Modern Mini Mart (ကျော် မီနီမတ်)',
        status: 'pending', requestedAt: '2026-02-03T09:00:00Z', isDemo: true,
      },
    },
    products: {
      'prod-w1-oil': {
        id: 'prod-w1-oil', wholesalerId: 'biz-wholesaler-1', name: 'Cooking Oil (စားသုံးဆီ)', brand: 'Good Morning (ရွှေကြာ)',
        category: 'Edible Oils', packageSize: '1 Liter', unit: 'bottle', description: 'Refined palm/vegetable olein, 1L bottle',
        isActive: true, currentPrice: 5000, stockQuantity: 180, lastUpdated: '2026-02-01T00:00:00Z', isDemo: true,
      },
      'prod-w2-oil': {
        id: 'prod-w2-oil', wholesalerId: 'biz-wholesaler-2', name: 'Cooking Oil (စားသုံးဆီ)', brand: 'Good Morning (ရွှေကြာ)',
        category: 'Edible Oils', packageSize: '1 Liter', unit: 'bottle', description: 'Refined cooking oil, 1L bottle (Mandalay)',
        isActive: true, currentPrice: 5200, stockQuantity: 240, lastUpdated: '2026-02-02T00:00:00Z', isDemo: true,
      },
      'prod-w1-rice': {
        id: 'prod-w1-rice', wholesalerId: 'biz-wholesaler-1', name: 'Shwebo Pawsan Rice (ရွှေဘိုပေါ်ဆန်းမွှေး)', brand: 'Ayeyar',
        category: 'Grains & Rice', packageSize: '5 kg', unit: 'bag', description: 'Premium aromatic fragrance rice',
        isActive: true, currentPrice: 18500, stockQuantity: 60, lastUpdated: '2026-02-01T00:00:00Z', isDemo: true,
      },
      'prod-w2-rice': {
        id: 'prod-w2-rice', wholesalerId: 'biz-wholesaler-2', name: 'Shwebo Pawsan Rice (ရွှေဘိုပေါ်ဆန်းမွှေး)', brand: 'Shwe Wah',
        category: 'Grains & Rice', packageSize: '5 kg', unit: 'bag', description: 'Aromatic rice 5kg (Mandalay depot)',
        isActive: true, currentPrice: 18200, stockQuantity: 90, lastUpdated: '2026-02-02T00:00:00Z', isDemo: true,
      },
      'prod-w1-milk': {
        id: 'prod-w1-milk', wholesalerId: 'biz-wholesaler-1', name: 'Condensed Milk (နို့ဆီ)', brand: 'Dawn (ဒေါ်န်း)',
        category: 'Dairy & Beverages', packageSize: '380 g', unit: 'tin', description: 'Sweetened condensed milk tin',
        isActive: true, currentPrice: 2200, stockQuantity: 300, lastUpdated: '2026-02-01T00:00:00Z', isDemo: true,
      },
    },
    priceHistory: {
      'ph-oil-1': {
        id: 'ph-oil-1', productId: 'prod-w1-oil', productName: 'Cooking Oil (စားသုံးဆီ) 1 Liter', wholesalerId: 'biz-wholesaler-1',
        oldPrice: 4700, newPrice: 5000, changeMMK: 300, changePercentage: 6.4, effectiveDate: '2026-02-01',
        updatedBy: 'user-wholesaler-1', sourceType: 'manual', sourceMessage: 'Base seasonal adjustment for February',
        timestamp: '2026-02-01T00:00:00Z', isDemo: true,
      },
      'ph-oil-2': {
        id: 'ph-oil-2', productId: 'prod-w2-oil', productName: 'Cooking Oil (စားသုံးဆီ) 1 Liter', wholesalerId: 'biz-wholesaler-2',
        oldPrice: 5000, newPrice: 5200, changeMMK: 200, changePercentage: 4.0, effectiveDate: '2026-02-02',
        updatedBy: 'user-wholesaler-2', sourceType: 'manual', sourceMessage: 'Transport cost adjustment',
        timestamp: '2026-02-02T00:00:00Z', isDemo: true,
      },
      'ph-rice-1': {
        id: 'ph-rice-1', productId: 'prod-w1-rice', productName: 'Shwebo Pawsan Rice (ရွှေဘိုပေါ်ဆန်းမွှေး) 5 kg', wholesalerId: 'biz-wholesaler-1',
        oldPrice: 17800, newPrice: 18500, changeMMK: 700, changePercentage: 3.9, effectiveDate: '2026-02-01',
        updatedBy: 'user-wholesaler-1', sourceType: 'manual', sourceMessage: 'Seasonal rice price increase',
        timestamp: '2026-02-01T00:00:00Z', isDemo: true,
      },
    },
    inventory: {
      'inv-ret1-oil': {
        id: 'inv-ret1-oil', retailerId: 'biz-retailer-1', supplierProductId: 'prod-w1-oil',
        name: 'Cooking Oil (စားသုံးဆီ) 1L Bottle', category: 'Edible Oils', unit: 'bottle', packageSize: '1 Liter',
        currentStock: 45, lowStockThreshold: 20, expiryDate: '2026-11-30', currentSellingPrice: 5600,
        lastSupplierCost: 5000, primaryWholesalerId: 'biz-wholesaler-1', primaryWholesalerName: 'Aung Wholesale Distribution',
        lastUpdated: '2026-02-01T00:00:00Z', isDemo: true,
      },
      'inv-ret1-rice': {
        id: 'inv-ret1-rice', retailerId: 'biz-retailer-1', supplierProductId: 'prod-w1-rice',
        name: 'Shwebo Pawsan Rice 5kg', category: 'Grains & Rice', unit: 'bag', packageSize: '5 kg',
        currentStock: 8, lowStockThreshold: 10, expiryDate: '2027-01-15', currentSellingPrice: 22000,
        lastSupplierCost: 18500, primaryWholesalerId: 'biz-wholesaler-1', primaryWholesalerName: 'Aung Wholesale Distribution',
        lastUpdated: '2026-02-01T00:00:00Z', isDemo: true,
      },
      'inv-ret1-milk': {
        id: 'inv-ret1-milk', retailerId: 'biz-retailer-1', supplierProductId: 'prod-w1-milk',
        name: 'Dawn Condensed Milk 380g', category: 'Dairy & Beverages', unit: 'tin', packageSize: '380 g',
        currentStock: 60, lowStockThreshold: 15, expiryDate: '2026-03-01', currentSellingPrice: 2600,
        lastSupplierCost: 2200, primaryWholesalerId: 'biz-wholesaler-1', primaryWholesalerName: 'Aung Wholesale Distribution',
        lastUpdated: '2026-02-01T00:00:00Z', isDemo: true,
      },
    },
    purchaseHistory: {
      'purchase-1': {
        id: 'purchase-1', retailerId: 'biz-retailer-1', inventoryItemId: 'inv-ret1-oil', wholesalerId: 'biz-wholesaler-1',
        wholesalerName: 'Aung Wholesale Distribution', quantity: 24, unit: 'bottle', unitCost: 5000, totalCost: 120000,
        orderId: 'ord-demo-1', receivedAt: '2026-02-06T14:00:00Z', receivedBy: 'user-retailer-1', isDemo: true,
      },
    },
    orders: {
      'ord-demo-1': {
        id: 'ord-demo-1', orderNumber: 'ORD-2026-001', retailerId: 'biz-retailer-1',
        retailerName: 'Shwe Family Grocery Store (ရွှေမိသားစု)', wholesalerId: 'biz-wholesaler-1',
        wholesalerName: 'Aung Wholesale Distribution (အောင် လက္ကား)',
        items: [
          { productId: 'prod-w1-oil', productName: 'Cooking Oil 1L bottle', unit: 'bottle', quantity: 24, agreedUnitPrice: 5000, lineTotal: 120000 },
          { productId: 'prod-w1-rice', productName: 'Shwebo Pawsan Rice 5kg bag', unit: 'bag', quantity: 10, agreedUnitPrice: 18500, lineTotal: 185000 },
        ],
        totalAmount: 305000, status: 'delivered', paymentStatus: 'partially_paid', paidAmount: 150000,
        notes: 'Deliver to rear storage door', placedAt: '2026-02-05T09:30:00Z', updatedAt: '2026-02-06T10:00:00Z', isDemo: true,
      },
      'ord-demo-2': {
        id: 'ord-demo-2', orderNumber: 'ORD-2026-002', retailerId: 'biz-retailer-1',
        retailerName: 'Shwe Family Grocery Store (ရွှေမိသားစု)', wholesalerId: 'biz-wholesaler-2',
        wholesalerName: 'Mandalay Commodity Depot (မန္တလေး ကုန်စည်ဒိုင်)',
        items: [
          { productId: 'prod-w2-oil', productName: 'Cooking Oil 1L bottle', unit: 'bottle', quantity: 12, agreedUnitPrice: 5200, lineTotal: 62400 },
        ],
        totalAmount: 62400, status: 'pending', paymentStatus: 'unpaid', paidAmount: 0,
        placedAt: '2026-02-07T11:15:00Z', updatedAt: '2026-02-07T11:15:00Z', isDemo: true,
      },
    },
    sales: {
      'sale-ret1-1': {
        id: 'sale-ret1-1', receiptNumber: 'RCPT-20260207-001', sellerId: 'biz-retailer-1',
        sellerName: 'Shwe Family Grocery Store (ရွှေမိသားစု)', sellerRole: 'retailer', channel: 'retail',
        customerName: 'Walk-in customer', customerPhone: undefined,
        items: [
          { productId: 'inv-ret1-oil', name: 'Cooking Oil (စားသုံးဆီ) 1L Bottle', unit: 'bottle', quantity: 2, unitPrice: 5600, unitCost: 5000, lineTotal: 11200 },
          { productId: 'inv-ret1-milk', name: 'Dawn Condensed Milk 380g', unit: 'tin', quantity: 3, unitPrice: 2600, unitCost: 2200, lineTotal: 7800 },
        ],
        subtotal: 19000, discount: 0, total: 19000, paymentMethod: 'cash', amountPaid: 20000, changeDue: 1000,
        status: 'completed', soldBy: 'user-retailer-1', soldAt: '2026-02-07T09:40:00Z', isDemo: true,
      },
      'sale-wh1-1': {
        id: 'sale-wh1-1', receiptNumber: 'RCPT-20260207-002', sellerId: 'biz-wholesaler-1',
        sellerName: 'Aung Wholesale Distribution (အောင် လက္ကား)', sellerRole: 'wholesaler', channel: 'wholesale',
        customerName: 'Daw San Myint Traders', customerPhone: '09785556677',
        items: [
          { productId: 'prod-w1-oil', name: 'Cooking Oil (စားသုံးဆီ) 1 Liter', unit: 'bottle', quantity: 100, unitPrice: 5000, lineTotal: 500000 },
          { productId: 'prod-w1-rice', name: 'Shwebo Pawsan Rice (ရွှေဘိုပေါ်ဆန်းမွှေး) 5 kg', unit: 'bag', quantity: 20, unitPrice: 18500, lineTotal: 370000 },
        ],
        subtotal: 870000, discount: 20000, total: 850000, paymentMethod: 'bank_transfer', amountPaid: 850000, changeDue: 0,
        status: 'completed', soldBy: 'user-wholesaler-1', soldAt: '2026-02-07T10:05:00Z', isDemo: true,
      },
    },
    notifications: {
      'notif-1': {
        id: 'notif-1', recipientId: 'biz-retailer-1', title: 'Welcome to PricePulse Myanmar',
        body: 'You are connected with Aung Wholesale Distribution and Mandalay Commodity Depot.',
        type: 'connection_decision', link: '/retailer/connections', read: false, createdAt: '2026-02-01T00:00:00Z', isDemo: true,
      },
    },
    drafts: {},
    auditLogs: {
      'audit-1': {
        id: 'audit-1', actorId: 'system', actorName: 'System', actorRole: 'system', action: 'DEMO_SEEDED',
        targetType: 'SYSTEM', targetId: 'demo', details: { message: 'Demo scenario initialized with 2 wholesalers, 2 retailers, 1 admin, Myanmar catalog' },
        timestamp: '2026-02-01T00:00:00Z', isDemo: true,
      },
    },
    thumbnails: {},
    thumbnailVotes: {},
    meta: {
      demo: {
        initializedAt: '2026-02-01T00:00:00Z',
        demoBusinessIds: ['biz-wholesaler-1', 'biz-wholesaler-2', 'biz-retailer-1', 'biz-retailer-2', 'biz-admin'],
        demoUserIds: ['user-wholesaler-1', 'user-wholesaler-2', 'user-retailer-1', 'user-retailer-2', 'user-admin'],
      },
    },
  };
}
