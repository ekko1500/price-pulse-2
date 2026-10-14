import { describe, it, expect, afterEach } from 'vitest';
import { validateModerationResult, moderateThumbnailImage } from '@/lib/ai/vision';

describe('validateModerationResult', () => {
  it('accepts a clear product image and extracts category + tags', () => {
    const v = validateModerationResult({
      isProductImage: true,
      appropriate: true,
      confidence: 0.9,
      category: 'Edible Oils',
      tags: ['oil', 'bottle', 'oil'],
    });
    expect(v.ok).toBe(true);
    expect(v.category).toBe('Edible Oils');
    expect(v.tags).toEqual(['oil', 'bottle']); // de-duplicated
  });

  it('rejects when it is not a product image or is inappropriate', () => {
    expect(validateModerationResult({ isProductImage: false, appropriate: true }).ok).toBe(false);
    expect(validateModerationResult({ isProductImage: true, appropriate: false }).ok).toBe(false);
  });

  it('coerces garbage safely', () => {
    const v = validateModerationResult(null);
    expect(v.ok).toBe(false);
    expect(v.confidence).toBeGreaterThanOrEqual(0);
    expect(v.tags).toEqual([]);
  });

  it('clamps confidence and caps the tag count', () => {
    const v = validateModerationResult({
      isProductImage: true,
      confidence: 5,
      tags: Array.from({ length: 20 }, (_, i) => `t${i}`),
    });
    expect(v.confidence).toBe(1);
    expect(v.tags.length).toBeLessThanOrEqual(6);
  });
});

describe('moderateThumbnailImage without an API key', () => {
  const prevKey = process.env.GEMINI_API_KEY;
  const prevMode = process.env.THUMBNAIL_MODERATION;

  afterEach(() => {
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevKey;
    if (prevMode === undefined) delete process.env.THUMBNAIL_MODERATION;
    else process.env.THUMBNAIL_MODERATION = prevMode;
  });

  it('accepts as unchecked in lenient mode (offline-friendly)', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.THUMBNAIL_MODERATION;
    const r = await moderateThumbnailImage({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/webp', itemLabel: 'Oil' });
    expect(r.status).toBe('unchecked');
    expect(r.usedAi).toBe(false);
  });

  it('rejects in strict mode', async () => {
    delete process.env.GEMINI_API_KEY;
    process.env.THUMBNAIL_MODERATION = 'strict';
    const r = await moderateThumbnailImage({ bytes: new Uint8Array([1]), mimeType: 'image/webp', itemLabel: 'Oil' });
    expect(r.status).toBe('rejected');
  });
});
