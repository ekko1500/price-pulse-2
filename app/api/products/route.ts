import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { visibleProducts } from '@/lib/auth/rbac';
import { SupplierProduct, PRODUCT_UNITS, ProductUnit } from '@/lib/types';
import { makeId } from '@/lib/util/id';
import { recordAudit } from '@/lib/services/events';
import { cleanString, validateNewPrice } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    await dbStore.ready();
    const g = guard(req);
    if (g.response) return g.response;
    const data = dbStore.getData();
    return json({ products: visibleProducts(data, g.ctx!) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbStore.ready();
    const g = guard(req, ['wholesaler']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);

    const name = cleanString(body.name);
    const category = cleanString(body.category);
    const unit = String(body.unit ?? '') as ProductUnit;
    const price = validateNewPrice(body.currentPrice);

    if (name.length < 2) return fail('VALIDATION', 'Product name is required.', 422);
    if (category.length < 2) return fail('VALIDATION', 'Category is required.', 422);
    if (!PRODUCT_UNITS.includes(unit)) return fail('VALIDATION', 'Choose a valid unit.', 422);
    if (price === null) return fail('VALIDATION', 'Enter a valid positive price in MMK.', 422);

    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const nowISO = new Date().toISOString();
      const product: SupplierProduct = {
        id: makeId('prod'),
        wholesalerId: ctx.business.id,
        name,
        brand: cleanString(body.brand) || undefined,
        category,
        packageSize: cleanString(body.packageSize) || undefined,
        unit,
        description: cleanString(body.description) || undefined,
        isActive: true,
        currentPrice: price,
        lastUpdated: nowISO,
        isDemo: ctx.isDemo,
      };
      data.products[product.id] = product;
      const seedHistoryId = makeId('ph');
      data.priceHistory[seedHistoryId] = {
        id: seedHistoryId,
        productId: product.id,
        productName: `${product.name}${product.packageSize ? ' ' + product.packageSize : ''}`,
        wholesalerId: ctx.business.id,
        oldPrice: 0,
        newPrice: price,
        changeMMK: price,
        changePercentage: 0,
        effectiveDate: nowISO.split('T')[0],
        updatedBy: ctx.user.id,
        sourceType: 'manual',
        sourceMessage: 'Initial price on product creation',
        timestamp: nowISO,
        isDemo: ctx.isDemo,
      };
      recordAudit(data, {
        actorId: ctx.user.id, actorName: ctx.business.name, actorRole: ctx.user.role,
        action: 'PRODUCT_CREATED', targetType: 'PRODUCT', targetId: product.id,
        details: { name, price }, isDemo: ctx.isDemo,
      });
      return json({ product }, 201);
    });
  } catch (e) {
    return handleError(e);
  }
}
