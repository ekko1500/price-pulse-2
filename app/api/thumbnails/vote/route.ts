import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { voteThumbnail, ThumbnailError } from '@/lib/services/thumbnails';
import { cleanString } from '@/lib/validation';

export const runtime = 'nodejs';

/** Up/down vote on a reference thumbnail. One vote per user per picture. */
export async function POST(req: NextRequest) {
  try {
    await dbStore.ready();
    const g = guard(req, ['retailer', 'wholesaler', 'admin']);
    if (g.response) return g.response;
    const ctx = g.ctx!;
    const body = await readJson(req);

    const thumbnailId = cleanString(body.thumbnailId);
    const value = Number(body.value);
    if (!thumbnailId) return fail('VALIDATION', 'A thumbnail id is required.', 422);
    if (value !== 1 && value !== -1) return fail('VALIDATION', 'Vote must be +1 or -1.', 422);

    return await dbStore.exclusive(async () => {
      try {
        const result = voteThumbnail(dbStore.getData(), ctx, thumbnailId, value as 1 | -1);
        return json(result);
      } catch (err) {
        if (err instanceof ThumbnailError) return fail(err.code, err.message, err.status);
        throw err;
      }
    });
  } catch (e) {
    return handleError(e);
  }
}
