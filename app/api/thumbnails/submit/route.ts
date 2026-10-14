import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, handleError } from '@/lib/api/http';
import { submitThumbnail, ThumbnailError } from '@/lib/services/thumbnails';
import {
  thumbnailStorageConfigured,
  isAllowedThumbnailType,
  MAX_THUMBNAIL_BYTES,
  uploadThumbnail,
} from '@/lib/storage/firebaseStorage';
import { cleanString } from '@/lib/validation';

export const runtime = 'nodejs';

/**
 * Submit a reference picture for an item. The first one becomes active; later
 * ones are suggestions, gated by the active picture's downvotes and the
 * per-item / per-user limits (enforced in the service).
 */
export async function POST(req: NextRequest) {
  try {
    await dbStore.ready();
    const g = guard(req, ['retailer', 'wholesaler']);
    if (g.response) return g.response;
    const ctx = g.ctx!;

    const form = await req.formData();
    const file = form.get('file');
    const itemKey = cleanString(form.get('itemKey'));
    const label = cleanString(form.get('label'));

    if (!(file instanceof File)) return fail('VALIDATION', 'Attach an image file.', 422);
    if (file.size === 0) return fail('VALIDATION', 'The uploaded image is empty.', 422);
    if (file.size > MAX_THUMBNAIL_BYTES) {
      return fail('TOO_LARGE', `Image exceeds the ${Math.round(MAX_THUMBNAIL_BYTES / 1024 / 1024)} MB limit.`, 413);
    }
    if (!isAllowedThumbnailType(file.type)) {
      return fail('VALIDATION', 'Only WebP, JPEG or PNG images are allowed.', 422);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    let url: string;
    let storagePath: string | undefined;
    if (thumbnailStorageConfigured()) {
      const uploaded = await uploadThumbnail(itemKey || label, file.type, bytes);
      url = uploaded.url;
      storagePath = uploaded.storagePath;
    } else {
      // Local development without Firebase Storage: keep the image inline.
      url = `data:${file.type};base64,${Buffer.from(bytes).toString('base64')}`;
    }

    return await dbStore.exclusive(async () => {
      try {
        const thumbnail = submitThumbnail(dbStore.getData(), ctx, { itemKey, label, url, storagePath });
        return json({ thumbnail }, 201);
      } catch (err) {
        if (err instanceof ThumbnailError) return fail(err.code, err.message, err.status);
        throw err;
      }
    });
  } catch (e) {
    return handleError(e);
  }
}
