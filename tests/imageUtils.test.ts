import { describe, it, expect } from 'vitest';
import { isWebpBlob, WEBP_QUALITY, JPEG_FALLBACK_QUALITY } from '@/components/imageUtils';

describe('image encoding helpers', () => {
  it('detects a real WebP blob and rejects silent fallbacks', () => {
    expect(isWebpBlob(new Blob([], { type: 'image/webp' }))).toBe(true);
    expect(isWebpBlob(new Blob([], { type: 'image/png' }))).toBe(false);
    expect(isWebpBlob(new Blob([]))).toBe(false);
  });

  it('uses a WebP quality no heavier than the JPEG fallback', () => {
    expect(WEBP_QUALITY).toBeLessThanOrEqual(JPEG_FALLBACK_QUALITY);
  });
});
