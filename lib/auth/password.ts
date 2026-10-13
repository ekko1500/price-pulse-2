import crypto from 'crypto';

/**
 * Password hashing using Node's scrypt. No plaintext passwords are ever stored.
 * Format stored: { passwordHash, passwordSalt } (both hex).
 */

const KEYLEN = 64;

export function hashPassword(password: string, salt?: string): { passwordHash: string; passwordSalt: string } {
  const passwordSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, passwordSalt, KEYLEN).toString('hex');
  return { passwordHash, passwordSalt };
}

export function verifyPassword(password: string, passwordHash: string, passwordSalt: string): boolean {
  try {
    const expected = Buffer.from(passwordHash, 'hex');
    const actual = crypto.scryptSync(password, passwordSalt, KEYLEN);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** Known demo passwords (only used to seed the isolated demo dataset). */
export const DEMO_PASSWORDS: Record<string, string> = {
  'user-wholesaler-1': 'Wholesale#2026',
  'user-wholesaler-2': 'Wholesale#2026',
  'user-retailer-1': 'Retailer#2026',
  'user-retailer-2': 'Retailer#2026',
  'user-admin': 'Admin#2026',
};
