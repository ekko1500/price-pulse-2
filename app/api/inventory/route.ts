import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { RetailerInventoryItem } from '@/lib/types';
import { makeId } from '@/lib/util/id';
import { recordAudit } from '@/lib/services/events';
import { cleanString, isPositiveNumber, isValidISODate } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    await dbStore.ready();
    const g = guard(req, ['retailer']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const data = dbStore.getData();
    const inventory = Object.values(data.inventory).filter((i) => i.retailerId === ctx.business.id);
    return json({ inventory });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbStore.ready();
    const g = guard(req, ['retailer']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);

    const name = cleanString(body.name);
    const category = cleanString(body.category) || 'Uncategorised';
    const unit = cleanString(body.unit) || 'piece';
    const currentStock = Number(body.currentStock ?? 0);
    const lowStockThreshold = Number(body.lowStockThreshold ?? 10);
    const currentSellingPrice = Number(body.currentSellingPrice ?? 0);
    const lastSupplierCost = Number(body.lastSupplierCost ?? 0);
    const expiryDate = cleanString(body.expiryDate);

    if (name.length < 2) return fail('VALIDATION', 'Item name is required.', 422);
    if (!Number.isFinite(currentStock) || currentStock < 0) return fail('VALIDATION', 'Stock must be zero or more.', 422);
    if (!Number.isFinite(currentSellingPrice) || currentSellingPrice < 0) return fail('VALIDATION', 'Selling price must be zero or more.', 422);

    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const nowISO = new Date().toISOString();
      const item: RetailerInventoryItem = {
        id: makeId('inv'),
        retailerId: ctx.business.id,
        name,
        category,
        unit,
        packageSize: cleanString(body.packageSize) || undefined,
        currentStock: Math.round(currentStock),
        lowStockThreshold: Number.isFinite(lowStockThreshold) ? Math.max(0, Math.round(lowStockThreshold)) : 10,
        expiryDate: isValidISODate(expiryDate) ? expiryDate : undefined,
        currentSellingPrice: Math.round(currentSellingPrice),
        lastSupplierCost: isPositiveNumber(lastSupplierCost) ? Math.round(lastSupplierCost) : 0,
        lastUpdated: nowISO,
        isDemo: ctx.isDemo,
      };
      data.inventory[item.id] = item;
      recordAudit(data, {
        actorId: ctx.user.id, actorName: ctx.business.name, actorRole: ctx.user.role,
        action: 'INVENTORY_CREATED', targetType: 'INVENTORY', targetId: item.id,
        details: { name }, isDemo: ctx.isDemo,
      });
      return json({ item }, 201);
    });
  } catch (e) {
    return handleError(e);
  }
}
