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

export function validateNewPrice(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  if (n > 100_000_000) return null; // sanity ceiling for MMK per unit
  return Math.round(n);
}
