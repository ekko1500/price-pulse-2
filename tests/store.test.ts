import { describe, it, expect, beforeAll } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';

let store: typeof import('@/lib/db/store').dbStore;
let dataDir: string;

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pricepulse-test-'));
  process.env.PRICEPULSE_DATA_DIR = dataDir;
  const mod = await import('@/lib/db/store');
  store = mod.dbStore;
  store.seedDemo();
});

describe('demo/vs/real isolation', () => {
  it('resetDemo preserves real records and sessions while restoring demo ones', () => {
    const data = store.getData();

    // A "real" (non-demo) account + session that must survive the reset.
    data.users['user-real'] = {
      id: 'user-real', username: 'real_shop', passwordHash: 'x', passwordSalt: 'y',
      phoneNumber: '09420000000', role: 'retailer', businessId: 'biz-real',
      isActive: true, isDemo: false, createdAt: new Date().toISOString(),
    };
    data.businesses['biz-real'] = {
      id: 'biz-real', name: 'Real Shop', ownerId: 'user-real', role: 'retailer',
      phoneNumber: '09420000000', createdAt: new Date().toISOString(), isDemo: false,
    };
    data.sessions['token-real'] = {
      token: 'token-real', userId: 'user-real', createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 100000).toISOString(), isDemo: false,
    };
    // A stray demo draft that the reset should remove.
    data.drafts['draft-demo'] = {
      id: 'draft-demo', wholesalerId: 'biz-wholesaler-1', productName: 'X', unit: 'bottle',
      newPrice: 1, currency: 'MMK', confidence: 1, missingFields: [], warnings: [],
      sourceType: 'manual', candidateProductIds: [], status: 'pending', createdBy: 'x',
      createdAt: new Date().toISOString(), isDemo: true,
    };
    store.persist();

    const result = store.resetDemo();
    const after = store.getData();

    expect(result.removed).toBeGreaterThan(0);
    expect(after.users['user-real']).toBeDefined();
    expect(after.businesses['biz-real']).toBeDefined();
    expect(after.sessions['token-real']).toBeDefined();
    expect(after.drafts['draft-demo']).toBeUndefined();
    expect(after.users['user-admin']).toBeDefined();
  });

  it('persists the dataset to disk', () => {
    const file = path.join(dataDir, '.pricepulse_data.json');
    expect(fs.existsSync(file)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(parsed.users['user-real']).toBeDefined();
  });
});
