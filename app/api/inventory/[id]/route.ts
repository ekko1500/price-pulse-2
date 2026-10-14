import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { recordAudit } from '@/lib/services/events';
import { cleanString, isValidISODate } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbStore.ready();
    const g = guard(req, ['retailer']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);

    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const item = data.inventory[params.id];
      if (!item) return fail('NOT_FOUND', 'Inventory item not found.', 404);
      if (item.retailerId !== ctx.business.id) return fail('FORBIDDEN', 'This item belongs to another retailer.', 403);

      if (body.name !== undefined) {
        const name = cleanString(body.name);
        if (name.length < 2) return fail('VALIDATION', 'Item name is required.', 422);
        item.name = name;
      }
      if (body.category !== undefined) item.category = cleanString(body.category) || 'Uncategorised';
      if (body.unit !== undefined) item.unit = cleanString(body.unit) || 'piece';
      if (body.packageSize !== undefined) item.packageSize = cleanString(body.packageSize) || undefined;
      if (body.currentStock !== undefined) {
        const stock = Number(body.currentStock);
        if (!Number.isFinite(stock) || stock < 0) return fail('VALIDATION', 'Stock must be zero or more.', 422);
        item.currentStock = Math.round(stock);
      }
      if (body.lowStockThreshold !== undefined) {
        const th = Number(body.lowStockThreshold);
        if (!Number.isFinite(th) || th < 0) return fail('VALIDATION', 'Threshold must be zero or more.', 422);
        item.lowStockThreshold = Math.round(th);
      }
      if (body.currentSellingPrice !== undefined) {
        const p = Number(body.currentSellingPrice);
        if (!Number.isFinite(p) || p < 0) return fail('VALIDATION', 'Selling price must be zero or more.', 422);
        item.currentSellingPrice = Math.round(p);
      }
      if (body.lastSupplierCost !== undefined) {
        const c = Number(body.lastSupplierCost);
        if (!Number.isFinite(c) || c < 0) return fail('VALIDATION', 'Supplier cost must be zero or more.', 422);
        item.lastSupplierCost = Math.round(c);
      }
      if (body.expiryDate !== undefined) {
        const d = cleanString(body.expiryDate);
        item.expiryDate = isValidISODate(d) ? d : undefined;
      }
      item.lastUpdated = new Date().toISOString();
      data.inventory[item.id] = item;

      recordAudit(data, {
        actorId: ctx.user.id, actorName: ctx.business.name, actorRole: ctx.user.role,
        action: 'INVENTORY_UPDATED', targetType: 'INVENTORY', targetId: item.id, isDemo: ctx.isDemo,
      });
      return json({ item });
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbStore.ready();
    const g = guard(req, ['retailer']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const item = data.inventory[params.id];
      if (!item) return fail('NOT_FOUND', 'Inventory item not found.', 404);
      if (item.retailerId !== ctx.business.id) return fail('FORBIDDEN', 'This item belongs to another retailer.', 403);
      delete data.inventory[item.id];
      recordAudit(data, {
        actorId: ctx.user.id, actorName: ctx.business.name, actorRole: ctx.user.role,
        action: 'INVENTORY_DELETED', targetType: 'INVENTORY', targetId: item.id, isDemo: ctx.isDemo,
      });
      return json({ success: true });
    });
  } catch (e) {
    return handleError(e);
  }
}
