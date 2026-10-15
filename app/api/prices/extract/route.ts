import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { extractPrice } from '@/lib/ai/extractor';
import { PriceUpdateDraft, SupplierProduct } from '@/lib/types';
import { makeId } from '@/lib/util/id';
import { recordAudit } from '@/lib/services/events';

/**
 * Capture + Extract (Steps A & B). Wholesaler pastes a supplier message; we run
 * server-side extraction and store a PENDING draft. Nothing is published here.
 */
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const g = guard(req, ['wholesaler']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);
    const message = typeof body.message === 'string' ? body.message : '';
    if (message.trim().length < 3) return fail('VALIDATION', 'Paste a supplier message to analyse.', 422);
    if (message.length > 4000) return fail('VALIDATION', 'Message is too long (max 4000 characters).', 422);

    const catalog: SupplierProduct[] = Object.values(dbStore.getData().products).filter(
      (p) => p.wholesalerId === ctx.business.id
    );

    const extracted = await extractPrice(message, catalog);

    return await dbStore.exclusive(async () => {
      // Read the store INSIDE the transaction: in Firestore mode `exclusive`
      // replaces the in-memory snapshot with the latest committed state, so a
      // reference captured beforehand would be stale and the write would be lost.
      const data = dbStore.getData();
      const nowISO = new Date().toISOString();
      const draft: PriceUpdateDraft = {
        id: makeId('draft'),
        wholesalerId: ctx.business.id,
        productId: extracted.candidateProductIds[0],
        productName: extracted.productName,
        brand: extracted.brand,
        packageSize: extracted.packageSize,
        unit: extracted.unit || 'piece',
        previousPrice: extracted.previousPrice,
        newPrice: extracted.newPrice,
        currency: 'MMK',
        effectiveDate: extracted.effectiveDate,
        confidence: extracted.confidence,
        missingFields: extracted.missingFields,
        warnings: extracted.warnings,
        notes: extracted.notes,
        sourceType: 'gemini_extraction',
        rawMessage: message,
        candidateProductIds: extracted.candidateProductIds,
        status: 'pending',
        createdBy: ctx.user.id,
        createdAt: nowISO,
        isDemo: ctx.isDemo,
      };
      data.drafts[draft.id] = draft;
      recordAudit(data, {
        actorId: ctx.user.id, actorName: ctx.business.name, actorRole: ctx.user.role,
        action: 'PRICE_DRAFT_CREATED', targetType: 'DRAFT', targetId: draft.id,
        details: { confidence: draft.confidence, missing: draft.missingFields }, isDemo: ctx.isDemo,
      });
      return json({ draft, usedAi: Boolean(process.env.GEMINI_API_KEY) }, 201);
    });
  } catch (e) {
    return handleError(e);
  }
}
