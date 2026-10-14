import { NextRequest } from 'next/server';
import { persistenceMode } from '@/lib/db/store';
import { firebaseConfigured } from '@/lib/firebase/admin';
import { thumbnailStorageConfigured } from '@/lib/storage/firebaseStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lightweight deployment health/config probe. Reports which storage/AI modes are
 * active and whether the request carried a session cookie (useful for verifying
 * the Firebase Hosting → Cloud Run rewrite).
 */
export async function GET(req: NextRequest) {
  return Response.json({
    ok: true,
    persistence: persistenceMode(),
    firebase: firebaseConfigured(),
    storage: thumbnailStorageConfigured(),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    receivedCookie: Boolean(req.headers.get('cookie')),
    host: req.headers.get('host') ?? null,
    forwardedHost: req.headers.get('x-forwarded-host') ?? null,
  });
}
