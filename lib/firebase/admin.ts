/**
 * Shared Firebase Admin bootstrap (server-only). Used by the Firestore adapter
 * and the Storage uploader so the app is initialised exactly once.
 */

import { cert, getApps, initializeApp, App } from 'firebase-admin/app';

export function firebaseConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
  );
}

export function adminApp(): App {
  const g = globalThis as unknown as { __ppFirebaseApp?: App };
  if (g.__ppFirebaseApp) return g.__ppFirebaseApp;
  const existing = getApps();
  const app =
    existing.length > 0
      ? existing[0]
      : initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
          }),
        });
  g.__ppFirebaseApp = app;
  return app;
}

export function storageBucketName(): string {
  return process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
}
