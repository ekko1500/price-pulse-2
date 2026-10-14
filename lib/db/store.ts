/**
 * PricePulse persistence layer.
 *
 * Two interchangeable backends behind one accessor surface:
 *  - "file":  a single server-side JSON document (default; single process).
 *  - "firestore": Cloud Firestore via the Admin SDK (multi-instance safe),
 *    selected automatically when the Firebase admin env vars are present.
 *
 * The public API stays synchronous where routes already use it (`getData`), with
 * `ready()` guaranteeing the cache is loaded before use and `exclusive()`
 * serialising read-modify-write blocks and flushing changed records.
 *
 * NOTE (honesty): the file backend is single-process. Use the Firestore backend
 * for multi-instance/serverless deployments. See ARCHITECTURE_AND_SECURITY.md.
 */

import fs from 'fs';
import path from 'path';
import { DatabaseSchema, buildDemoData } from '../seed/demo';

// NOTE: the Firestore adapter (and firebase-admin) is imported lazily inside the
// async paths so the file backend does not pay its startup cost.

const DATA_DIR = process.env.PRICEPULSE_DATA_DIR || process.cwd();
const DB_FILE = path.join(DATA_DIR, '.pricepulse_data.json');
/** How long a warm instance may reuse its cache before re-reading Firestore. */
const CACHE_TTL_MS = 3000;

export type PersistenceMode = 'file' | 'firestore';

export function persistenceMode(): PersistenceMode {
  return process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
    ? 'firestore'
    : 'file';
}

/** JSON-safe deep clone (records contain only plain data). */
function cloneSchema(data: DatabaseSchema): DatabaseSchema {
  return JSON.parse(JSON.stringify(data)) as DatabaseSchema;
}

class DataStore {
  private data: DatabaseSchema;
  private baseline: DatabaseSchema;
  private loaded = false;
  private loading: Promise<void> | null = null;
  private lastLoadedAt = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private flushChain: Promise<void> = Promise.resolve();

  constructor() {
    this.data = buildDemoData();
    this.baseline = cloneSchema(this.data);
  }

  private loadFile(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        return this.normalize(JSON.parse(raw) as Partial<DatabaseSchema>);
      }
    } catch (e) {
      console.warn('PricePulse store: failed to read data file, reseeding demo data.', e);
    }
    const fresh = buildDemoData();
    this.writeFile(fresh);
    return fresh;
  }

  private writeFile(data: DatabaseSchema): void {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('PricePulse store: failed to persist data file.', e);
    }
  }

  /** Backfill any missing collections so older documents keep working. */
  private normalize(parsed: Partial<DatabaseSchema>): DatabaseSchema {
    const base = buildDemoData();
    return {
      users: parsed.users ?? {},
      businesses: parsed.businesses ?? {},
      sessions: parsed.sessions ?? {},
      connections: parsed.connections ?? {},
      products: parsed.products ?? {},
      priceHistory: parsed.priceHistory ?? {},
      inventory: parsed.inventory ?? {},
      purchaseHistory: parsed.purchaseHistory ?? {},
      orders: parsed.orders ?? {},
      sales: parsed.sales ?? {},
      notifications: parsed.notifications ?? {},
      drafts: parsed.drafts ?? {},
      auditLogs: parsed.auditLogs ?? {},
      thumbnails: parsed.thumbnails ?? {},
      thumbnailVotes: parsed.thumbnailVotes ?? {},
      meta: parsed.meta ?? base.meta,
    };
  }

  /**
   * Ensure the in-memory cache is loaded. File mode loads once; Firestore mode
   * reloads when the cache is older than the TTL (or when `force` is set).
   */
  async ready(force = false): Promise<void> {
    const mode = persistenceMode();
    if (this.loaded && !force) {
      if (mode === 'file' || Date.now() - this.lastLoadedAt < CACHE_TTL_MS) return;
    }
    if (this.loading) {
      await this.loading;
      return;
    }
    this.loading = (async () => {
      let next: DatabaseSchema;
      if (mode === 'firestore') {
        const { loadSchema } = await import('./firestore');
        next = await loadSchema();
      } else {
        next = this.loadFile();
      }
      this.data = next;
      this.baseline = cloneSchema(next);
      this.loaded = true;
      this.lastLoadedAt = Date.now();
    })();
    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  /** Raw schema access. Callers MUST enforce authorization themselves. */
  getData(): DatabaseSchema {
    return this.data;
  }

  private async flushInternal(): Promise<void> {
    const current = cloneSchema(this.data);
    const { writeDiff } = await import('./firestore');
    await writeDiff(this.baseline, current);
    this.baseline = current;
  }

  /** Schedule persistence of any in-memory changes (file: immediate; Firestore: queued). */
  persist(): void {
    if (persistenceMode() === 'file') {
      this.writeFile(this.data);
      this.baseline = cloneSchema(this.data);
      return;
    }
    this.flushChain = this.flushChain
      .then(() => this.flushInternal())
      .catch((e) => console.error('PricePulse store: flush failed.', e));
  }

  /** Await any queued persistence (used by callers that need write-through). */
  async flush(): Promise<void> {
    await this.flushChain;
  }

  /**
   * Serialise a read-modify-write block. Loads a fresh snapshot, runs `fn`, then
   * flushes only the records that changed.
   */
  async exclusive<T>(fn: () => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      await this.ready(true);
      const result = await fn();
      this.persist();
      await this.flush();
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Fresh isolated demo dataset. */
  seedDemo(): void {
    this.data = buildDemoData();
    this.schedulePersist();
  }

  private schedulePersist(): void {
    this.persist();
  }

  /**
   * Reset only records flagged isDemo, leaving real (non-demo) records untouched.
   * Safe to retry. Sessions are intentionally preserved.
   */
  resetDemo(): { removed: number; restored: number } {
    const fresh = buildDemoData();
    let removed = 0;
    let restored = 0;

    const collectionKeys: Array<Exclude<keyof DatabaseSchema, 'meta' | 'sessions'>> = [
      'users', 'businesses', 'connections', 'products', 'priceHistory',
      'inventory', 'purchaseHistory', 'orders', 'sales', 'notifications', 'drafts', 'auditLogs',
      'thumbnails', 'thumbnailVotes',
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
    this.schedulePersist();
    return { removed, restored };
  }
}

// Singleton across Next.js dev hot-reloads.
const globalForStore = globalThis as unknown as { __pricePulseStore?: DataStore };
export const dbStore: DataStore = globalForStore.__pricePulseStore ?? new DataStore();
if (!globalForStore.__pricePulseStore) globalForStore.__pricePulseStore = dbStore;
