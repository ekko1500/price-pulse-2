/** Domain shapes the bot consumes from the PricePulse web API. */

export type Role = 'retailer' | 'wholesaler' | 'admin';

export interface BotUser {
  id: string;
  username: string;
  role: Role;
  businessId: string;
  phoneNumber?: string;
}

export interface Business {
  id: string;
  name: string;
  role: Role;
  city?: string;
}

export interface Product {
  id: string;
  name: string;
  brand?: string;
  category: string;
  packageSize?: string;
  unit: string;
  currentPrice: number;
}

export interface Draft {
  id: string;
  productId?: string;
  productName: string;
  brand?: string;
  packageSize?: string;
  unit: string;
  previousPrice?: number;
  newPrice: number;
  effectiveDate?: string;
  confidence: number;
  missingFields: string[];
  warnings: string[];
  candidateProductIds: string[];
  status: string;
}

export interface ExtractResult {
  draft: Draft;
  usedAi: boolean;
  model: string;
}

export interface PublishResult {
  success: boolean;
  product: Product;
  history: { oldPrice: number; newPrice: number; effectiveDate: string };
  notifiedBusinessIds: string[];
}
