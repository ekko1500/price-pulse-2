/**
 * Cloud Firestore persistence for PricePulse.
 *
 * One document per record, in collections named after the in-memory schema keys.
 * The server (Admin SDK) is the only writer and bypasses firestore.rules; the
 * browser never talks to Firestore directly.
 *
 * This module is server-only and must run on the Node.js runtime.
 */

import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { DatabaseSchema, buildDemoData } from '../seed/demo';
import { adminApp } from '../firebase/admin';

export const COLLECTIONS = [
  'users',
  'businesses',
  'sessions',
  'connections',
  'products',
  'priceHistory',
  'inventory',
  'purchaseHistory',
  'orders',
  'sales',
  'notifications',
  'drafts',
  'auditLogs',
  'thumbnails',
  'thumbnailVotes',
] as const;

export type CollectionKey = (typeof COLLECTIONS)[number];

const META_COLLECTION = 'meta';
const META_DOC = 'app';

let cachedDb: Firestore | null = null;
export function firestoreDb(): Firestore {
  if (!cachedDb) cachedDb = getFirestore(adminApp());
  return cachedDb;
}

export function emptySchema(): DatabaseSchema {
  return {
    users: {},
    businesses: {},
    sessions: {},
    connections: {},
    products: {},
    priceHistory: {},
    inventory: {},
    purchaseHistory: {},
    orders: {},
    sales: {},
    notifications: {},
    drafts: {},
    auditLogs: {},
    thumbnails: {},
    thumbnailVotes: {},
    meta: {},
  };
}

/** Firestore rejects `undefined`; strip it recursively from plain data. */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as unknown as T;
  }
  return value;
}

/** Read every collection into a schema object, seeding demo data when empty. */
export async function loadSchema(): Promise<DatabaseSchema> {
  const db = firestoreDb();
  const data = emptySchema();

  await Promise.all(
    COLLECTIONS.map(async (key) => {
      const snap = await db.collection(key).get();
      for (const doc of snap.docs) {
        (data[key] as Record<string, unknown>)[doc.id] = doc.data();
      }
    })
  );

  const metaSnap = await db.collection(META_COLLECTION).doc(META_DOC).get();
  if (metaSnap.exists) data.meta = metaSnap.data() as DatabaseSchema['meta'];

  const totalDocs = COLLECTIONS.reduce((n, key) => n + Object.keys(data[key]).length, 0);
  if (totalDocs === 0) {
    const fresh = buildDemoData();
    await writeDiff(emptySchema(), fresh);
    return fresh;
  }
  return data;
}

interface Op {
  type: 'set' | 'del';
  collection: string;
  id: string;
  data?: Record<string, unknown>;
}

function diffCollection(
  collection: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ops: Op[]
): void {
  for (const id of Object.keys(after)) {
    if (!before[id] || JSON.stringify(before[id]) !== JSON.stringify(after[id])) {
      ops.push({ type: 'set', collection, id, data: stripUndefined(after[id]) as Record<string, unknown> });
    }
  }
  for (const id of Object.keys(before)) {
    if (!after[id]) ops.push({ type: 'del', collection, id });
  }
}

/** Persist only the records that differ between two schema snapshots. */
export async function writeDiff(baseline: DatabaseSchema, current: DatabaseSchema): Promise<void> {
  const db = firestoreDb();
  const ops: Op[] = [];

  for (const key of COLLECTIONS) {
    diffCollection(key, baseline[key] as Record<string, unknown>, current[key] as Record<string, unknown>, ops);
  }
  if (JSON.stringify(baseline.meta) !== JSON.stringify(current.meta)) {
    ops.push({ type: 'set', collection: META_COLLECTION, id: META_DOC, data: stripUndefined(current.meta) as Record<string, unknown> });
  }

  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + 400)) {
      const ref = db.collection(op.collection).doc(op.id);
      if (op.type === 'set') batch.set(ref, op.data as Record<string, unknown>);
      else batch.delete(ref);
    }
    await batch.commit();
  }
}
