/**
 * Centralised thumbnail storage on Firebase Storage (server-only).
 *
 * Thumbnails are shared across all businesses. Files are written with a public
 * download token so they can be served via a stable URL without making the
 * whole bucket public. When Firebase is not configured (local development), the
 * caller falls back to an inline data URL instead.
 */

import crypto from 'crypto';
import { getStorage } from 'firebase-admin/storage';
import { adminApp, firebaseConfigured, storageBucketName } from '../firebase/admin';

export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024; // 5 MB per thumbnail

const ALLOWED_TYPES: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export function thumbnailStorageConfigured(): boolean {
  return firebaseConfigured() && Boolean(storageBucketName());
}

export function isAllowedThumbnailType(contentType: unknown): contentType is string {
  return typeof contentType === 'string' && contentType.toLowerCase() in ALLOWED_TYPES;
}

function safeKey(itemKey: string): string {
  return itemKey.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}

/** Upload a thumbnail and return its public URL + storage path. */
export async function uploadThumbnail(
  itemKey: string,
  contentType: string,
  bytes: Uint8Array
): Promise<{ url: string; storagePath: string }> {
  const bucket = getStorage(adminApp()).bucket(storageBucketName());
  const ext = ALLOWED_TYPES[contentType.toLowerCase()] ?? 'bin';
  const storagePath = `thumbnails/${safeKey(itemKey)}/${crypto.randomUUID()}.${ext}`;
  const token = crypto.randomUUID();

  await bucket.file(storagePath).save(Buffer.from(bytes), {
    contentType,
    resumable: false,
    metadata: {
      cacheControl: 'public, max-age=31536000',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
    storagePath
  )}?alt=media&token=${token}`;
  return { url, storagePath };
}

/** Best-effort delete of a stored object (used when a picture is replaced). */
export async function deleteThumbnailObject(storagePath: string | undefined): Promise<void> {
  if (!storagePath || !thumbnailStorageConfigured()) return;
  try {
    await getStorage(adminApp()).bucket(storageBucketName()).file(storagePath).delete();
  } catch {
    /* best effort */
  }
}
