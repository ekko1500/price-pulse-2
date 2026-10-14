import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { submitThumbnail, submissionState, ThumbnailError } from '@/lib/services/thumbnails';
import {
  thumbnailStorageConfigured,
  isOurStorageUrl,
  parseStorageUrl,
  downloadThumbnailBytes,
  deleteThumbnailObject,
  isAllowedThumbnailType,
  MAX_THUMBNAIL_BYTES,
} from '@/lib/storage/firebaseStorage';
import { moderateThumbnailImage } from '@/lib/ai/vision';
import { normalizeItemKey } from '@/lib/thumbnails/constants';
import { cleanString } from '@/lib/validation';

export const runtime = 'nodejs';

function parseDataUrl(url: string): { contentType: string; bytes: Uint8Array } | null {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(url);
  if (!m) return null;
  try {
    return { contentType: m[1].toLowerCase(), bytes: new Uint8Array(Buffer.from(m[2], 'base64')) };
  } catch {
    return null;
  }
}

/**
 * Submit a reference picture. The browser uploads to Firebase Storage with the
 * client SDK and posts the resulting URL here; the server validates the URL,
 * downloads the bytes to run Gemini moderation, then stores the thumbnail (the
 * first picture becomes active, later ones are gated suggestions).
 */
export async function POST(req: NextRequest) {
  try {
    await dbStore.ready();
    const g = guard(req, ['retailer', 'wholesaler']);
    if (g.response) return g.response;
    const ctx = g.ctx!;

    const body = await readJson(req);
    const itemKey = cleanString(body.itemKey);
    const label = cleanString(body.label);
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!url) return fail('VALIDATION', 'An image URL is required.', 422);

    const useStorage = thumbnailStorageConfigured();
    let storagePath: string | undefined;
    if (useStorage) {
      if (!isOurStorageUrl(url)) return fail('VALIDATION', 'Image must be uploaded to our storage bucket.', 422);
      storagePath = parseStorageUrl(url)?.path;
    }

    // Fail fast (and clean up the orphaned upload) when submissions are closed.
    const pre = submissionState(dbStore.getData(), ctx.user.id, normalizeItemKey(itemKey || label));
    if (!pre.canSubmit) {
      await deleteThumbnailObject(storagePath);
      return fail('SUBMISSION_CLOSED', 'Submissions are closed for this item.', 409);
    }

    // Resolve the image bytes for moderation.
    let bytes: Uint8Array;
    let contentType: string;
    if (useStorage && storagePath) {
      try {
        const downloaded = await downloadThumbnailBytes(storagePath);
        bytes = downloaded.bytes;
        contentType = downloaded.contentType;
      } catch {
        return fail('VALIDATION', 'The uploaded image could not be read.', 422);
      }
    } else {
      const inline = parseDataUrl(url);
      if (!inline) {
        return fail('VALIDATION', 'Provide a Firebase Storage URL (inline data URLs are accepted in local development).', 422);
      }
      bytes = inline.bytes;
      contentType = inline.contentType;
    }

    if (bytes.length > MAX_THUMBNAIL_BYTES) {
      await deleteThumbnailObject(storagePath);
      return fail('TOO_LARGE', `Image exceeds the ${Math.round(MAX_THUMBNAIL_BYTES / 1024 / 1024)} MB limit.`, 413);
    }
    if (!isAllowedThumbnailType(contentType)) {
      await deleteThumbnailObject(storagePath);
      return fail('VALIDATION', 'Only WebP, JPEG or PNG images are allowed.', 422);
    }

    // AI moderation + smart tagging.
    const moderation = await moderateThumbnailImage({ bytes, mimeType: contentType, itemLabel: label || itemKey });
    if (moderation.status === 'rejected') {
      await deleteThumbnailObject(storagePath);
      return fail('IMAGE_REJECTED', moderation.reason || 'The image did not pass moderation.', 422);
    }

    return await dbStore.exclusive(async () => {
      try {
        const thumbnail = submitThumbnail(dbStore.getData(), ctx, {
          itemKey,
          label,
          url,
          storagePath,
          category: moderation.category,
          tags: moderation.tags,
          moderation: {
            status: moderation.status,
            reason: moderation.reason,
            model: moderation.model,
            confidence: moderation.confidence,
            checkedAt: new Date().toISOString(),
          },
        });
        return json({ thumbnail, moderation: { status: moderation.status, reason: moderation.reason } }, 201);
      } catch (err) {
        if (err instanceof ThumbnailError) {
          await deleteThumbnailObject(storagePath);
          return fail(err.code, err.message, err.status);
        }
        throw err;
      }
    });
  } catch (e) {
    return handleError(e);
  }
}
