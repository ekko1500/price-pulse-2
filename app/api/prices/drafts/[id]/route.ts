import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { PRODUCT_UNITS, ProductUnit } from '@/lib/types';
import { cleanString, validateNewPrice } from '@/lib/validation';

/** Step C/D - the wholesaler corrects/confirms a draft. Still not published. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const g = guard(req, ['wholesaler']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);

    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const draft = data.drafts[params.id];
      if (!draft) return fail('NOT_FOUND', 'Draft not found.', 404);
      if (draft.wholesalerId !== ctx.business.id) return fail('FORBIDDEN', 'This draft belongs to another wholesaler.', 403);
      if (draft.status !== 'pending') return fail('INVALID_STATE', 'Only pending drafts can be edited.', 409);

      if (body.productId !== undefined) {
        const pid = cleanString(body.productId);
        if (pid) {
          const product = data.products[pid];
          if (!product || product.wholesalerId !== ctx.business.id) {
            return fail('FORBIDDEN', 'You can only link your own products.', 403);
          }
          draft.productId = pid;
        } else {
          draft.productId = undefined;
        }
      }
      if (body.productName !== undefined) draft.productName = cleanString(body.productName);
      if (body.brand !== undefined) draft.brand = cleanString(body.brand) || undefined;
      if (body.packageSize !== undefined) draft.packageSize = cleanString(body.packageSize) || undefined;
      if (body.unit !== undefined) {
        const unit = String(body.unit);
        if (!PRODUCT_UNITS.includes(unit as ProductUnit)) return fail('VALIDATION', 'Choose a valid unit.', 422);
        draft.unit = unit;
      }
      if (body.newPrice !== undefined) {
        const price = validateNewPrice(body.newPrice);
        if (price === null) return fail('VALIDATION', 'Enter a valid positive price in MMK.', 422);
        draft.newPrice = price;
      }
      if (body.previousPrice !== undefined) {
        draft.previousPrice = validateNewPrice(body.previousPrice) ?? undefined;
      }
      if (body.effectiveDate !== undefined) {
        const d = cleanString(body.effectiveDate);
        draft.effectiveDate = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
      }

      // Recompute which required fields remain missing / resolved.
      const missing = new Set(draft.missingFields);
      if (draft.newPrice > 0) missing.delete('newPrice');
      else missing.add('newPrice');
      if (draft.productId) { missing.delete('productName'); }
      if (draft.productName) missing.delete('productName');
      if (draft.unit) missing.delete('unit');
      else missing.add('unit');
      draft.missingFields = Array.from(missing);

      if (draft.missingFields.length === 0) {
        draft.confidence = Math.max(draft.confidence, 0.85);
      }

      data.drafts[draft.id] = draft;
      return json({ draft });
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
      const draft = data.drafts[params.id];
      if (!draft) return fail('NOT_FOUND', 'Draft not found.', 404);
      if (draft.wholesalerId !== ctx.business.id) return fail('FORBIDDEN', 'Not your draft.', 403);
      draft.status = 'rejected';
      data.drafts[draft.id] = draft;
      return json({ success: true });
    });
  } catch (e) {
    return handleError(e);
  }
}
