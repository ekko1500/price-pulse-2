import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { PriceUpdateDraft, SupplierProduct } from '@/lib/types';
import { makeId } from '@/lib/util/id';
import { recordAudit } from '@/lib/services/events';
import { cleanString, validateNewPrice } from '@/lib/validation';

interface RowResult {
  row: number;
  status: 'draft_created' | 'error';
  message?: string;
  draftId?: string;
  productName?: string;
}

/**
 * Bulk price import. Each valid row becomes a PENDING draft that goes through the
 * same review + confirmation + audit + notification path as an AI draft. Prices
 * are never published directly from the import.
 */
export async function POST(req: NextRequest) {
  try {
    await dbStore.ready();
    const g = guard(req, ['wholesaler']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);
    const rows = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]) : [];
    if (rows.length === 0) return fail('VALIDATION', 'No rows to import.', 422);
    if (rows.length > 2000) return fail('TOO_MANY_ROWS', 'Too many rows.', 413);

    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const catalog: SupplierProduct[] = Object.values(data.products).filter(
        (p) => p.wholesalerId === ctx.business.id
      );
      const byName = new Map(catalog.map((p) => [p.name.toLowerCase(), p]));
      const nowISO = new Date().toISOString();
      const results: RowResult[] = [];
      let created = 0;
      let errors = 0;

      rows.forEach((raw, idx) => {
        const rowNo = idx + 1;
        const price = validateNewPrice(raw.newPrice ?? raw.price);
        if (price === null) {
          errors += 1;
          results.push({ row: rowNo, status: 'error', message: 'Invalid or missing price.' });
          return;
        }
        const pid = cleanString(raw.productId);
        const name = cleanString(raw.productName ?? raw.name);
        const product =
          (pid ? catalog.find((p) => p.id === pid) : undefined) ||
          (name ? byName.get(name.toLowerCase()) : undefined);

        const effectiveDate = cleanString(raw.effectiveDate);
        const draft: PriceUpdateDraft = {
          id: makeId('draft'),
          wholesalerId: ctx.business.id,
          productId: product?.id,
          productName: product?.name || name || '',
          brand: product?.brand,
          packageSize: product?.packageSize,
          unit: product?.unit || cleanString(raw.unit) || 'piece',
          previousPrice: product?.currentPrice,
          newPrice: price,
          currency: 'MMK',
          effectiveDate: /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ? effectiveDate : undefined,
          confidence: product ? 0.99 : 0.5,
          missingFields: product ? [] : ['productName'],
          warnings: product ? [] : ['No matching catalog product; select one before publishing.'],
          sourceType: 'csv_import',
          rawMessage: undefined,
          candidateProductIds: product ? [product.id] : [],
          status: 'pending',
          createdBy: ctx.user.id,
          createdAt: nowISO,
          isDemo: ctx.isDemo,
        };
        data.drafts[draft.id] = draft;
        created += 1;
        results.push({ row: rowNo, status: 'draft_created', draftId: draft.id, productName: draft.productName });
      });

      recordAudit(data, {
        actorId: ctx.user.id, actorName: ctx.business.name, actorRole: ctx.user.role,
        action: 'PRICE_IMPORT_DRAFTS_CREATED', targetType: 'DRAFT', targetId: 'bulk',
        details: { created, errors }, isDemo: ctx.isDemo,
      });

      return json({ created, errors, results });
    });
  } catch (e) {
    return handleError(e);
  }
}
