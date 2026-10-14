import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, handleError } from '@/lib/api/http';
import { publishPriceChange, PricingError } from '@/lib/services/pricing';
import { recordAudit } from '@/lib/services/events';
import { PRODUCT_UNITS, ProductUnit } from '@/lib/types';

/**
 * Step E - Publish. The wholesaler explicitly confirms a reviewed draft.
 * Server re-validates everything; AI output is never trusted here.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbStore.ready();
    const g = guard(req, ['wholesaler']);
    if (g.response) return g.response;
    const ctx = g.ctx!;

    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const draft = data.drafts[params.id];
      if (!draft) return fail('NOT_FOUND', 'Draft not found.', 404);
      if (draft.wholesalerId !== ctx.business.id) return fail('FORBIDDEN', 'This draft belongs to another wholesaler.', 403);
      if (draft.status !== 'pending') return fail('INVALID_STATE', 'This draft has already been processed.', 409);

      if (!draft.productId) return fail('VALIDATION', 'Select the product this price belongs to before publishing.', 422);
      const product = data.products[draft.productId];
      if (!product || product.wholesalerId !== ctx.business.id) {
        return fail('FORBIDDEN', 'The selected product is not in your catalog.', 403);
      }
      if (draft.newPrice <= 0) return fail('VALIDATION', 'A valid new price is required.', 422);
      if (!PRODUCT_UNITS.includes(draft.unit as ProductUnit)) return fail('VALIDATION', 'A valid unit is required.', 422);

      try {
        const result = publishPriceChange(data, {
          product,
          newPrice: draft.newPrice,
          effectiveDate: draft.effectiveDate,
          sourceType: draft.sourceType,
          sourceMessage: draft.rawMessage,
          confirmedDraftId: draft.id,
          actorUserId: ctx.user.id,
          isDemo: ctx.isDemo,
        });

        draft.status = 'confirmed';
        draft.confirmedAt = new Date().toISOString();
        draft.confirmedBy = ctx.user.id;
        draft.publishedHistoryId = result.history.id;
        data.drafts[draft.id] = draft;

        recordAudit(data, {
          actorId: ctx.user.id, actorName: ctx.business.name, actorRole: ctx.user.role,
          action: 'PRICE_PUBLISHED', targetType: 'PRODUCT', targetId: product.id,
          details: {
            oldPrice: result.history.oldPrice,
            newPrice: result.history.newPrice,
            notified: result.notifiedBusinessIds.length,
            draftId: draft.id,
          },
          isDemo: ctx.isDemo,
        });

        return json({
          success: true,
          product: result.product,
          history: result.history,
          notifiedBusinessIds: result.notifiedBusinessIds,
        });
      } catch (err) {
        if (err instanceof PricingError) return fail(err.code, err.message, err.status);
        throw err;
      }
    });
  } catch (e) {
    return handleError(e);
  }
}
