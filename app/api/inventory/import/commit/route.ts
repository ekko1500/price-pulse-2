import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { RetailerInventoryItem } from '@/lib/types';
import { makeId } from '@/lib/util/id';
import { recordAudit } from '@/lib/services/events';
import { cleanString, isValidISODate } from '@/lib/validation';

interface RowResult {
  row: number;
  status: 'imported' | 'skipped' | 'error';
  message?: string;
  name?: string;
}

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Commit previously-previewed inventory rows. Validates every row, detects
 * duplicates by name, never silently overwrites. Returns per-row results.
 */
export async function POST(req: NextRequest) {
  try {
    const g = guard(req, ['retailer']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);
    const rows = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]) : [];
    const duplicateStrategy = body.duplicateStrategy === 'error' ? 'error' : 'skip';

    if (rows.length === 0) return fail('VALIDATION', 'No rows to import.', 422);
    if (rows.length > 2000) return fail('TOO_MANY_ROWS', 'Too many rows.', 413);

    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const existing = Object.values(data.inventory).filter((i) => i.retailerId === ctx.business.id);
      const existingNames = new Set(existing.map((i) => i.name.toLowerCase()));
      const nowISO = new Date().toISOString();
      const results: RowResult[] = [];
      let imported = 0;
      let skipped = 0;
      let errors = 0;

      rows.forEach((raw, idx) => {
        const rowNo = idx + 1;
        const name = cleanString(raw.name);
        if (name.length < 2) {
          errors += 1;
          results.push({ row: rowNo, status: 'error', message: 'Missing item name.' });
          return;
        }
        if (existingNames.has(name.toLowerCase())) {
          if (duplicateStrategy === 'error') {
            errors += 1;
            results.push({ row: rowNo, status: 'error', message: 'Duplicate of an existing item.', name });
          } else {
            skipped += 1;
            results.push({ row: rowNo, status: 'skipped', message: 'Skipped duplicate.', name });
          }
          return;
        }

        const stock = num(raw.currentStock);
        const sell = num(raw.currentSellingPrice);
        const cost = num(raw.lastSupplierCost);
        const threshold = num(raw.lowStockThreshold);
        if (stock !== null && stock < 0) { errors += 1; results.push({ row: rowNo, status: 'error', message: 'Stock cannot be negative.', name }); return; }
        if (sell !== null && sell < 0) { errors += 1; results.push({ row: rowNo, status: 'error', message: 'Selling price cannot be negative.', name }); return; }

        const expiryRaw = cleanString(raw.expiryDate);
        const item: RetailerInventoryItem = {
          id: makeId('inv'),
          retailerId: ctx.business.id,
          name,
          category: cleanString(raw.category) || 'Uncategorised',
          unit: cleanString(raw.unit) || 'piece',
          packageSize: cleanString(raw.packageSize) || undefined,
          currentStock: Math.max(0, Math.round(stock ?? 0)),
          lowStockThreshold: Math.max(0, Math.round(threshold ?? 10)),
          expiryDate: isValidISODate(expiryRaw) ? expiryRaw : undefined,
          currentSellingPrice: Math.max(0, Math.round(sell ?? 0)),
          lastSupplierCost: Math.max(0, Math.round(cost ?? 0)),
          lastUpdated: nowISO,
          isDemo: ctx.isDemo,
        };
        data.inventory[item.id] = item;
        existingNames.add(name.toLowerCase());
        imported += 1;
        results.push({ row: rowNo, status: 'imported', name });
      });

      recordAudit(data, {
        actorId: ctx.user.id, actorName: ctx.business.name, actorRole: ctx.user.role,
        action: 'INVENTORY_IMPORTED', targetType: 'INVENTORY', targetId: 'bulk',
        details: { imported, skipped, errors }, isDemo: ctx.isDemo,
      });

      return json({ imported, skipped, errors, results });
    });
  } catch (e) {
    return handleError(e);
  }
}
