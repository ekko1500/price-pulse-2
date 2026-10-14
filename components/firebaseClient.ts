'use client';

/**
 * Client-side Firebase Storage upload helper.
 *
 * The browser downscales the picture and uploads it directly to Firebase Storage
 * with the Firebase web SDK, then hands the resulting download URL to our API
 * (which moderates it and records the thumbnail). When Firebase isn't configured
 * (local development), the caller falls back to an inline data URL.
 */

import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const config: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

export function firebaseClientConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.storageBucket);
}

function app() {
  return getApps().length ? getApp() : initializeApp(config);
}

function safeKey(itemKey: string): string {
  return itemKey.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}

function extensionFor(contentType: string): string {
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/png') return 'png';
  return 'jpg';
}

/** Upload a (already downscaled) blob to Storage and return its public URL. */
export async function uploadThumbnailClient(blob: Blob, itemKey: string): Promise<string> {
  const storage = getStorage(app());
  const contentType = blob.type || 'image/jpeg';
  const path = `thumbnails/${safeKey(itemKey)}/${crypto.randomUUID()}.${extensionFor(contentType)}`;
  const objectRef = ref(storage, path);
  await uploadBytes(objectRef, blob, { contentType });
  return getDownloadURL(objectRef);
}
