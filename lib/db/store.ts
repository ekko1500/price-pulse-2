/**
 * PricePulse persistence layer.
 *
 * Default mode is a persistent, server-side JSON document store with Firestore-like
 * collection semantics. It is safe for a single Node process (all writes are
 * serialised through an exclusive queue). It is designed to be swapped for Cloud
 * Firestore via the same accessor surface when credentials are configured.
 *
 * NOTE (honesty): this is NOT a distributed database. Cross-process concurrency
 * safety relies on Firestore in production. See ARCHITECTURE_AND_SECURITY.md.
 */

import fs from 'fs';
import path from 'path';
import { DatabaseSchema, buildDemoData } from '../seed/demo';

const DATA_DIR = process.env.PRICEPULSE_DATA_DIR || process.cwd();
const DB_FILE = path.join(DATA_DIR, '.pricepulse_data.json');

export type PersistenceMode = 'file' | 'firestore';

export function persistenceMode(): PersistenceMode {
  return process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
    ? 'firestore'
    : 'file';
}

class DataStore {
  private data: DatabaseSchema;
  private queue: Promise<unknown> = Promise.resolve();

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
        return this.normalize(parsed);
      }
    } catch (e) {
      console.warn('PricePulse store: failed to read data file, reseeding demo data.', e);
    }
    const fresh = buildDemoData();
    this.write(fresh);
    return fresh;
  }

  /** Backfill any missing collections so older data files keep working. */
  private normalize(parsed: Partial<DatabaseSchema>): DatabaseSchema {
    const base = buildDemoData();
    const merged: DatabaseSchema = {
      users: parsed.users ?? {},
      businesses: parsed.businesses ?? {},
      sessions: parsed.sessions ?? {},
      connections: parsed.connections ?? {},
      products: parsed.products ?? {},
      priceHistory: parsed.priceHistory ?? {},
      inventory: parsed.inventory ?? {},
      purchaseHistory: parsed.purchaseHistory ?? {},
      orders: parsed.orders ?? {},
      notifications: parsed.notifications ?? {},
      drafts: parsed.drafts ?? {},
      auditLogs: parsed.auditLogs ?? {},
      meta: parsed.meta ?? base.meta,
    };
    return merged;
  }

  private write(data: DatabaseSchema): void {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('PricePulse store: failed to persist data file.', e);
    }
  }

  /** Raw schema access. Callers MUST enforce authorization themselves. */
  getData(): DatabaseSchema {
    return this.data;
  }

  persist(): void {
    this.write(this.data);
  }

  /**
   * Serialise a read-modify-write block. Any mutation inside `fn` is flushed once
   * `fn` resolves. Prevents interleaved writes within the process.
   */
  async exclusive<T>(fn: () => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const result = await fn();
      this.persist();
      return result;
    });
    // keep the chain alive even if this block throws
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Fresh isolated demo dataset. */
  seedDemo(): void {
    this.data = buildDemoData();
    this.write(this.data);
  }

  /**
   * Reset only records flagged isDemo, leaving real (non-demo) records untouched.
   * Safe to retry.
   */
  resetDemo(): { removed: number; restored: number } {
    const fresh = buildDemoData();
    let removed = 0;
    let restored = 0;

    // NOTE: sessions are intentionally preserved so the admin performing the reset
    // stays signed in. Demo logins are re-established from the seeded demo users.
    const collectionKeys: Array<Exclude<keyof DatabaseSchema, 'meta' | 'sessions'>> = [
      'users', 'businesses', 'connections', 'products', 'priceHistory',
      'inventory', 'purchaseHistory', 'orders', 'notifications', 'drafts', 'auditLogs',
    ];

    for (const key of collectionKeys) {
      const current = (this.data[key] || {}) as Record<string, { isDemo?: boolean }>;
      const realItems: Record<string, unknown> = {};
      for (const [id, item] of Object.entries(current)) {
        if (item && item.isDemo) removed += 1;
        else realItems[id] = item;
      }
      const freshDemo = (fresh[key] || {}) as Record<string, unknown>;
      restored += Object.keys(freshDemo).length;
      (this.data[key] as Record<string, unknown>) = { ...freshDemo, ...realItems };
    }
    this.data.meta = fresh.meta;
    this.write(this.data);
    return { removed, restored };
  }
}

// Singleton across Next.js dev hot-reloads.
const globalForStore = globalThis as unknown as { __pricePulseStore?: DataStore };
export const dbStore: DataStore = globalForStore.__pricePulseStore ?? new DataStore();
if (!globalForStore.__pricePulseStore) globalForStore.__pricePulseStore = dbStore;
