import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { ownsProduct } from '@/lib/auth/rbac';
import { PRODUCT_UNITS, ProductUnit } from '@/lib/types';
import { recordAudit } from '@/lib/services/events';
import { cleanString, cleanStringList, validateImageData } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const g = guard(req, ['wholesaler']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);

    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const product = data.products[params.id];
      if (!product) return fail('NOT_FOUND', 'Product not found.', 404);
      if (!ownsProduct(ctx, product)) return fail('FORBIDDEN', 'This product belongs to another wholesaler.', 403);

      if (body.name !== undefined) {
        const name = cleanString(body.name);
        if (name.length < 2) return fail('VALIDATION', 'Product name is required.', 422);
        product.name = name;
      }
      if (body.category !== undefined) product.category = cleanString(body.category);
      if (body.brand !== undefined) product.brand = cleanString(body.brand) || undefined;
      if (body.packageSize !== undefined) product.packageSize = cleanString(body.packageSize) || undefined;
      if (body.description !== undefined) product.description = cleanString(body.description) || undefined;
      if (body.itemId !== undefined) product.itemId = cleanString(body.itemId).slice(0, 40) || undefined;
      if (body.sku !== undefined) product.sku = cleanString(body.sku).slice(0, 40) || undefined;
      if (body.nameEn !== undefined) product.nameEn = cleanString(body.nameEn) || undefined;
      if (body.nameMy !== undefined) product.nameMy = cleanString(body.nameMy) || undefined;
      if (body.colloquialNameMy !== undefined) product.colloquialNameMy = cleanString(body.colloquialNameMy) || undefined;
      if (body.searchKeywords !== undefined) {
        const keywords = cleanStringList(body.searchKeywords);
        product.searchKeywords = keywords.length ? keywords : undefined;
      }
      if (body.aliases !== undefined) {
        const aliases = cleanStringList(body.aliases);
        product.aliases = aliases.length ? aliases : undefined;
      }
      if (body.imageData !== undefined) {
        const imageData = validateImageData(body.imageData);
        if (imageData === null) return fail('VALIDATION', 'Product image must be a valid image under 300 KB.', 422);
        product.imageData = imageData || undefined;
      }
      if (body.unit !== undefined) {
        const unit = String(body.unit) as ProductUnit;
        if (!PRODUCT_UNITS.includes(unit)) return fail('VALIDATION', 'Choose a valid unit.', 422);
        product.unit = unit;
      }
      if (body.isActive !== undefined) product.isActive = Boolean(body.isActive);
      product.lastUpdated = new Date().toISOString();
      data.products[product.id] = product;

      recordAudit(data, {
        actorId: ctx.user.id, actorName: ctx.business.name, actorRole: ctx.user.role,
        action: 'PRODUCT_UPDATED', targetType: 'PRODUCT', targetId: product.id, isDemo: ctx.isDemo,
      });
      return json({ product });
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const g = guard(req, ['wholesaler']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const product = data.products[params.id];
      if (!product) return fail('NOT_FOUND', 'Product not found.', 404);
      if (!ownsProduct(ctx, product)) return fail('FORBIDDEN', 'This product belongs to another wholesaler.', 403);
      // Soft delete: keep history intact.
      product.isActive = false;
      product.lastUpdated = new Date().toISOString();
      data.products[product.id] = product;
      recordAudit(data, {
        actorId: ctx.user.id, actorName: ctx.business.name, actorRole: ctx.user.role,
        action: 'PRODUCT_DEACTIVATED', targetType: 'PRODUCT', targetId: product.id, isDemo: ctx.isDemo,
      });
      return json({ success: true });
    });
  } catch (e) {
    return handleError(e);
  }
}
