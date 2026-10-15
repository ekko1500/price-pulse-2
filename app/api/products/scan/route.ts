import { NextRequest } from 'next/server';
import { guard, json, fail, readJson, handleError } from '@/lib/api/http';
import { validateImageData } from '@/lib/validation';
import { scanProductImage } from '@/lib/ai/productScan';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const g = guard(req, ['wholesaler']);
    if (g.response) return g.response;
    const body = await readJson(req);

    const image = validateImageData(body.image ?? body.imageData, 2_000_000);
    if (!image) return fail('VALIDATION', 'Attach a valid image to scan.', 422);
    if (!process.env.GEMINI_API_KEY) return fail('AI_UNAVAILABLE', 'AI is not configured.', 503);

    try {
      const product = await scanProductImage(image);
      return json({ product });
    } catch (err) {
      console.warn('Product image scan failed.', err);
      return fail('AI_FAILED', 'Could not read the image. Try another photo or fill the form manually.', 502);
    }
  } catch (e) {
    return handleError(e);
  }
}
