/**
 * Small, dependency-free validation helpers used across API routes.
 */

export interface FieldErrors {
  [field: string]: string;
}

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function cleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
}

export function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/**
 * Normalise a list of short strings (product aliases/keywords). Accepts an array
 * or a comma-separated string. Trims, collapses whitespace, drops empties, removes
 * case-insensitive duplicates and caps both the number of items and each length.
 */
export function cleanStringList(v: unknown, maxItems = 30, maxLen = 60): string[] {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    if (typeof raw !== 'string') continue;
    const item = cleanString(raw).slice(0, maxLen);
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Normalise a Myanmar phone number to digits; accept 09..., +959..., 9... */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/[\s-()]/g, '').replace(/^\+?95/, '0');
  if (!/^09\d{7,9}$/.test(digits)) return null;
  return digits;
}

export function isValidUsername(input: unknown): input is string {
  return typeof input === 'string' && /^[a-zA-Z0-9_.]{3,32}$/.test(input.trim());
}

export function isStrongEnoughPassword(input: unknown): input is string {
  return typeof input === 'string' && input.length >= 8 && /[a-zA-Z]/.test(input) && /\d/.test(input);
}

export function isValidISODate(input: unknown): input is string {
  if (typeof input !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!m) return false;
  const [, y, mo, d] = m.map(Number) as [number, number, number, number];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function validateRegistration(body: Record<string, unknown>): FieldErrors {
  const errors: FieldErrors = {};
  if (!isValidUsername(body.username)) errors.username = 'Username must be 3-32 chars (letters, numbers, _ or .).';
  if (!isStrongEnoughPassword(body.password)) errors.password = 'Password must be at least 8 characters and include a letter and a number.';
  if (!normalizePhone(body.phoneNumber)) errors.phoneNumber = 'Enter a valid Myanmar phone number (e.g. 09xxxxxxxxx).';
  if (!isNonEmptyString(body.businessName) || cleanString(body.businessName).length < 2) errors.businessName = 'Business name is required.';
  if (body.role !== 'retailer' && body.role !== 'wholesaler') errors.role = 'Role must be retailer or wholesaler.';
  return errors;
}

const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Max decoded size of a product image data URL. Images are stored inline in the single Firestore document. */
export const MAX_IMAGE_BYTES = 300_000;

/**
 * Validate an inline product image data URL.
 * Returns '' when no image is supplied, the data URL when valid, or null when
 * it is malformed or larger than `maxBytes` (after base64 decoding).
 */
export function validateImageData(v: unknown, maxBytes = MAX_IMAGE_BYTES): string | null {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v !== 'string' || !IMAGE_DATA_URL.test(v)) return null;
  const base64 = v.slice(v.indexOf(',') + 1);
  const padding = (base64.match(/=+$/) || [''])[0].length;
  const bytes = Math.floor((base64.length * 3) / 4) - padding;
  if (bytes > maxBytes) return null;
  return v;
}

export function validateNewPrice(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  if (n > 100_000_000) return null; // sanity ceiling for MMK per unit
  return Math.round(n);
}
