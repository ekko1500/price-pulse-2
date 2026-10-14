import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { publishPriceChange, PricingError } from '@/lib/services/pricing';
import { recordAudit } from '@/lib/services/events';
import { cleanString, validateNewPrice } from '@/lib/validation';

/**
 * Direct manual price publication (no AI). Wholesaler supplies productId + new price.
 * Uses the exact same validation/audit/notification path as the AI workflow.
 */
export async function POST(req: NextRequest) {
  try {
    await dbStore.ready();
    const g = guard(req, ['wholesaler']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);

    const productId = cleanString(body.productId);
    const price = validateNewPrice(body.newPrice);
    const effectiveDate = cleanString(body.effectiveDate);
    const sourceMessage = cleanString(body.sourceMessage) || undefined;

    if (!productId) return fail('VALIDATION', 'Choose a product.', 422);
    if (price === null) return fail('VALIDATION', 'Enter a valid positive price in MMK.', 422);

    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const product = data.products[productId];
      if (!product) return fail('NOT_FOUND', 'Product not found.', 404);
      if (product.wholesalerId !== ctx.business.id) {
        return fail('FORBIDDEN', 'You can only update prices for your own products.', 403);
      }

      try {
        const result = publishPriceChange(data, {
          product,
          newPrice: price,
          effectiveDate: /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ? effectiveDate : undefined,
          sourceType: 'manual',
          sourceMessage,
          actorUserId: ctx.user.id,
          isDemo: ctx.isDemo,
        });

        recordAudit(data, {
          actorId: ctx.user.id, actorName: ctx.business.name, actorRole: ctx.user.role,
          action: 'PRICE_PUBLISHED', targetType: 'PRODUCT', targetId: product.id,
          details: {
            oldPrice: result.history.oldPrice,
            newPrice: result.history.newPrice,
            notified: result.notifiedBusinessIds.length,
            source: 'manual',
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
