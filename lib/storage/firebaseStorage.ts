/**
 * Firebase Storage helpers (server-only).
 *
 * Thumbnails are uploaded directly from the browser with the Firebase Storage
 * client SDK; the server only *validates* the resulting URL, downloads the bytes
 * to run AI moderation, and deletes objects that are rejected or replaced.
 */

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

/** Parse a Firebase Storage download/public URL into bucket + object path. */
export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  if (typeof url !== 'string' || !url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === 'firebasestorage.googleapis.com') {
      const m = /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(u.pathname);
      if (!m) return null;
      return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) };
    }
    if (u.hostname === 'storage.googleapis.com') {
      const parts = u.pathname.replace(/^\//, '').split('/');
      if (parts.length < 2) return null;
      return { bucket: parts[0], path: parts.slice(1).join('/') };
    }
    return null;
  } catch {
    return null;
  }
}

/** True when the URL points at an object in our own Storage bucket. */
export function isOurStorageUrl(url: string): boolean {
  const parsed = parseStorageUrl(url);
  if (!parsed) return false;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  return (
    parsed.bucket === storageBucketName() ||
    (!!projectId && parsed.bucket.startsWith(`${projectId}.`))
  );
}

/** Download an object's bytes + content type (used for moderation). */
export async function downloadThumbnailBytes(
  path: string
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const file = getStorage(adminApp()).bucket(storageBucketName()).file(path);
  const [buf] = await file.download();
  const [meta] = await file.getMetadata();
  const contentType = typeof meta.contentType === 'string' ? meta.contentType : 'application/octet-stream';
  return { bytes: new Uint8Array(buf), contentType };
}

/** Best-effort delete of a stored object (used when a picture is rejected/replaced). */
export async function deleteThumbnailObject(storagePath: string | undefined): Promise<void> {
  if (!storagePath || !thumbnailStorageConfigured()) return;
  try {
    await getStorage(adminApp()).bucket(storageBucketName()).file(storagePath).delete();
  } catch {
    /* best effort */
  }
}
