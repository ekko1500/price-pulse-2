import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, DEMO_PASSWORDS } from '@/lib/auth/password';
import {
  normalizePhone,
  isValidUsername,
  isStrongEnoughPassword,
  isValidISODate,
  validateRegistration,
  validateNewPrice,
} from '@/lib/validation';
import { freshData, ctxFor } from './helpers';
import { hasActiveConnection, ownsProduct, visibleProducts } from '@/lib/auth/rbac';

describe('password hashing', () => {
  it('verifies the correct password and rejects others', () => {
    const { passwordHash, passwordSalt } = hashPassword('Retailer#2026');
    expect(verifyPassword('Retailer#2026', passwordHash, passwordSalt)).toBe(true);
    expect(verifyPassword('wrong', passwordHash, passwordSalt)).toBe(false);
  });

  it('uses a unique salt so identical passwords hash differently', () => {
    const a = hashPassword('same-password');
    const b = hashPassword('same-password');
    expect(a.passwordSalt).not.toBe(b.passwordSalt);
    expect(a.passwordHash).not.toBe(b.passwordHash);
  });

  it('never stores the plaintext password in the hash', () => {
    const { passwordHash } = hashPassword('Retailer#2026');
    expect(passwordHash).not.toContain('Retailer#2026');
  });

  it('seed demo passwords can be verified against seeded users', () => {
    const data = freshData();
    const user = data.users['user-retailer-1'];
    expect(verifyPassword(DEMO_PASSWORDS['user-retailer-1'], user.passwordHash, user.passwordSalt)).toBe(true);
  });
});

describe('input validation', () => {
  it('normalises Myanmar phone numbers', () => {
    expect(normalizePhone('09 421 112 233')).toBe('09421112233');
    expect(normalizePhone('+95 9421112233')).toBe('09421112233');
    expect(normalizePhone('nope')).toBeNull();
  });

  it('validates username and password strength', () => {
    expect(isValidUsername('shwe_store')).toBe(true);
    expect(isValidUsername('a b')).toBe(false);
    expect(isStrongEnoughPassword('Retailer#2026')).toBe(true);
    expect(isStrongEnoughPassword('short')).toBe(false);
    expect(isStrongEnoughPassword('nodigitshere')).toBe(false);
  });

  it('validates ISO dates', () => {
    expect(isValidISODate('2026-02-10')).toBe(true);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('10/02/2026')).toBe(false);
  });

  it('rejects registering as admin', () => {
    const errors = validateRegistration({
      username: 'someone', password: 'Passw0rdd', phoneNumber: '09421112233', businessName: 'Shop', role: 'admin',
    });
    expect(errors.role).toBeDefined();
  });

  it('validates new prices with a sanity ceiling', () => {
    expect(validateNewPrice('5,800')).toBe(5800);
    expect(validateNewPrice(-1)).toBeNull();
    expect(validateNewPrice(200_000_000)).toBeNull();
  });
});

describe('RBAC scoping', () => {
  it('retailers see only products from actively connected wholesalers', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-retailer-1'); // connected to w1 + w2 (both active)
    const products = visibleProducts(data, ctx);
    const wholesalers = new Set(products.map((p) => p.wholesalerId));
    expect(wholesalers).toEqual(new Set(['biz-wholesaler-1', 'biz-wholesaler-2']));
  });

  it('retailer-2 only sees the actively connected wholesaler (w1), not the pending one', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-retailer-2');
    const products = visibleProducts(data, ctx);
    expect(new Set(products.map((p) => p.wholesalerId))).toEqual(new Set(['biz-wholesaler-1']));
  });

  it('wholesalers only see their own products', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-wholesaler-2');
    expect(visibleProducts(data, ctx).every((p) => p.wholesalerId === 'biz-wholesaler-2')).toBe(true);
  });

  it('hasActiveConnection and ownsProduct behave correctly', () => {
    const data = freshData();
    expect(hasActiveConnection(data, 'biz-retailer-1', 'biz-wholesaler-1')).toBe(true);
    expect(hasActiveConnection(data, 'biz-retailer-2', 'biz-wholesaler-2')).toBe(false);
    const ctx = ctxFor(data, 'user-wholesaler-1');
    expect(ownsProduct(ctx, data.products['prod-w1-oil'])).toBe(true);
    expect(ownsProduct(ctx, data.products['prod-w2-oil'])).toBe(false);
  });
});
