/**
 * PricePulse persistence layer.
 *
 * Two interchangeable backends behind one synchronous read surface:
 *
 *  - `file` (default): a persistent, server-side JSON document store. Safe for a
 *    single Node process (all writes are serialised through an exclusive queue).
 *  - `firestore`: Cloud Firestore, enabled automatically when FIREBASE_PROJECT_ID,
 *    FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are set. Writes run inside
 *    Firestore transactions so they are durable and cross-instance safe.
 *
 * `getData()` is synchronous in both modes. In Firestore mode the schema is
 * hydrated from Firestore during startup (see instrumentation.ts), so callers only
 * observe fully-loaded data. See ARCHITECTURE_AND_SECURITY.md.
 */

import fs from 'fs';
import path from 'path';
import { DatabaseSchema, buildDemoData } from '../seed/demo';
import { isFirestoreConfigured, loadSnapshot, saveSnapshot, runTransaction } from './firestore';

const DATA_DIR = process.env.PRICEPULSE_DATA_DIR || process.cwd();
const DB_FILE = path.join(DATA_DIR, '.pricepulse_data.json');

export type PersistenceMode = 'file' | 'firestore';

export function persistenceMode(): PersistenceMode {
  const forced = process.env.PRICEPULSE_BACKEND;
  if (forced === 'file') return 'file';
  if (forced === 'firestore') return 'firestore';
  return isFirestoreConfigured() ? 'firestore' : 'file';
}

class DataStore {
  private readonly mode: PersistenceMode;
  private data: DatabaseSchema;
  private queue: Promise<unknown> = Promise.resolve();
  private readyPromise: Promise<void>;
  private lastSave: Promise<void> = Promise.resolve();
  private inTransaction = false;

  constructor() {
    this.mode = persistenceMode();
    if (this.mode === 'file') {
      this.data = this.load();
      this.readyPromise = Promise.resolve();
    } else {
      // Never expose an empty store: start from the demo seed and hydrate async.
      this.data = buildDemoData();
      this.readyPromise = this.initFirestore();
    }
  }

  /** Resolves once the store is hydrated (no-op in file mode). */
  ready(): Promise<void> {
    return this.readyPromise;
  }

  private async initFirestore(): Promise<void> {
    try {
      const snap = await loadSnapshot();
      if (snap) {
        this.data = this.normalize(snap);
      } else {
        await saveSnapshot(this.data);
      }
    } catch (e) {
      console.error('PricePulse store: Firestore init failed; serving in-memory data.', e);
    }
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

  /** Synchronous JSON write, file mode only. */
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

  /**
   * Persist the in-memory schema. File mode flushes synchronously; Firestore mode
   * schedules an async write (use `flush()` to await it). Inside an exclusive
   * block the surrounding transaction performs the write, so this is a no-op.
   */
  persist(): void {
    if (this.mode === 'file') {
      this.write(this.data);
      return;
    }
    if (this.inTransaction) return;
    this.lastSave = this.saveFirestore();
  }

  /** Await the most recent Firestore write (resolves immediately in file mode). */
  async flush(): Promise<void> {
    await this.readyPromise;
    await this.lastSave;
  }

  private async saveFirestore(): Promise<void> {
    try {
      await saveSnapshot(this.data);
    } catch (e) {
      console.error('PricePulse store: failed to persist to Firestore.', e);
    }
  }

  /**
   * Serialise a read-modify-write block. In Firestore mode the block runs inside a
   * transaction against the latest committed schema, so concurrent instances do
   * not clobber each other. Prevents interleaved writes within the process.
   */
  async exclusive<T>(fn: () => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      await this.readyPromise;
      if (this.mode === 'firestore') {
        return runTransaction<T>(async (current) => {
          if (current) this.data = this.normalize(current);
          this.inTransaction = true;
          try {
            const result = await fn();
            return { result, next: this.data };
          } finally {
            this.inTransaction = false;
          }
        });
      }
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
    if (this.mode === 'file') this.write(this.data);
    else this.persist();
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
    this.persist();
    return { removed, restored };
  }
}

// Singleton across Next.js dev hot-reloads.
const globalForStore = globalThis as unknown as { __pricePulseStore?: DataStore };
export const dbStore: DataStore = globalForStore.__pricePulseStore ?? new DataStore();
if (!globalForStore.__pricePulseStore) globalForStore.__pricePulseStore = dbStore;
