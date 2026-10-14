'use client';

/**
 * Client-side image pipeline for centralised reference thumbnails: downscale and
 * compress in the browser (WebP, JPEG fallback), then submit to the backend,
 * which stores the picture on Firebase Storage.
 */

import { apiUrl } from './api';
import { firebaseClientConfigured, uploadThumbnailClient } from './firebaseClient';
import type { ItemThumbnail } from '@/lib/types';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB source limit
export const WEBP_QUALITY = 0.8;
export const JPEG_FALLBACK_QUALITY = 0.82;

/** True when the browser actually produced a WebP blob (not a silent fallback). */
export function isWebpBlob(blob: Blob): boolean {
  return blob.type === 'image/webp';
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image could not be opened.'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image.'))),
      type,
      quality
    );
  });
}

async function encodeDownscaled(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const webp = await canvasToBlob(canvas, 'image/webp', quality);
  if (isWebpBlob(webp)) return webp;
  return canvasToBlob(canvas, 'image/jpeg', JPEG_FALLBACK_QUALITY);
}

/**
 * Resize a picked file to fit `maxDim` and re-encode it (WebP, JPEG fallback).
 * A white background is applied so transparency is handled consistently.
 */
export async function downscaleImage(file: File, maxDim = 512, quality = WEBP_QUALITY): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file (PNG, JPG, WebP or SVG).');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Image is larger than the 8 MB limit.');
  }
  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const largestSide = Math.max(img.width, img.height);
  if (!largestSide) return file;

  const scale = Math.min(1, maxDim / largestSide);
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return encodeDownscaled(canvas, quality);
}

export interface SubmitThumbnailInput {
  itemKey: string;
  label: string;
  file: File;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Downscale the picked file, upload it to Firebase Storage (client SDK), then
 * submit the resulting URL for moderation + recording. Falls back to an inline
 * data URL when Firebase isn't configured (local development).
 */
export async function submitReferenceImage(input: SubmitThumbnailInput): Promise<ItemThumbnail> {
  const blob = await downscaleImage(input.file);

  const url = firebaseClientConfigured()
    ? await uploadThumbnailClient(blob, input.itemKey)
    : await blobToDataUrl(blob);

  const res = await fetch(apiUrl('/api/thumbnails/submit'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemKey: input.itemKey, label: input.label, url }),
  });
  const data = (await res.json().catch(() => ({}))) as { thumbnail?: ItemThumbnail; message?: string };
  if (!res.ok || !data.thumbnail) {
    throw new Error(data.message || 'Could not submit the picture.');
  }
  return data.thumbnail;
}
