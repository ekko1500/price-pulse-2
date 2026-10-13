/**
 * Cloud Firestore storage adapter.
 *
 * The whole application schema is mirrored into a single Firestore document.
 * This keeps the existing synchronous read surface (`dbStore.getData()`) intact
 * while making writes durable and cross-instance safe through Firestore
 * transactions.
 *
 * HONEST LIMITS:
 *  - A single document is capped at 1 MiB. This is ample for the demo dataset and
 *    early production, but a real deployment at scale should shard the schema into
 *    collections. Migration path: replace `loadSnapshot`/`saveSnapshot` with
 *    per-collection reads/writes; the DataStore surface does not change.
 *  - Reads other than the transactional write path are served from memory. Run a
 *    single instance (see apphosting.yaml, maxInstances: 1) for read consistency.
 *
 * `firebase-admin` is imported lazily so it is never bundled or loaded unless
 * Firestore is actually configured.
 */

import type { DatabaseSchema } from '../seed/demo';

const DOC_PATH = process.env.PRICEPULSE_FIRESTORE_DOC || 'pricepulse/state';

interface AdminCache {
  db: any;
}

const globalForFirestore = globalThis as unknown as { __pricePulseFirestore?: AdminCache };

/** Explicit service-account credentials, suitable for non-GCP hosts and local dev. */
function hasServiceAccount(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

/**
 * Application Default Credentials are available automatically on managed Google
 * runtimes (Cloud Run / Firebase App Hosting set K_SERVICE). Opt in explicitly on
 * other hosts with PRICEPULSE_USE_ADC=1.
 */
function adcEnabled(): boolean {
  return Boolean(process.env.PRICEPULSE_USE_ADC || process.env.K_SERVICE || process.env.FIREBASE_CONFIG);
}

/** True when a Firestore backend can be initialised. */
export function isFirestoreConfigured(): boolean {
  return hasServiceAccount() || adcEnabled();
}

async function getDb(): Promise<any> {
  if (globalForFirestore.__pricePulseFirestore) return globalForFirestore.__pricePulseFirestore.db;

  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  if (getApps().length === 0) {
    if (hasServiceAccount()) {
      // Private keys are shared as env vars; support both literal `\n` and real newlines.
      const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
    } else {
      // Application Default Credentials (metadata server on Cloud Run / App Hosting).
      initializeApp(
        process.env.GOOGLE_CLOUD_PROJECT
          ? { projectId: process.env.GOOGLE_CLOUD_PROJECT }
          : undefined,
      );
    }
  }

  const db = getFirestore();
  globalForFirestore.__pricePulseFirestore = { db };
  return db;
}

/** Read the mirrored schema, or null when the document has not been written yet. */
export async function loadSnapshot(): Promise<DatabaseSchema | null> {
  const db = await getDb();
  const snap = await db.doc(DOC_PATH).get();
  if (!snap.exists) return null;
  const payload = snap.data()?.payload;
  return (payload as DatabaseSchema) ?? null;
}

/** Overwrite the mirrored schema. Last write wins. */
export async function saveSnapshot(data: DatabaseSchema): Promise<void> {
  const db = await getDb();
  await db.doc(DOC_PATH).set({
    payload: data,
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Run a read-modify-write inside a Firestore transaction. The callback receives
 * the freshest committed schema (or null) and returns the mutation result plus
 * the full next schema to persist. Firestore retries the callback on contention.
 */
export async function runTransaction<T>(
  apply: (current: DatabaseSchema | null) => Promise<{ result: T; next: DatabaseSchema }>,
): Promise<T> {
  const db = await getDb();
  return db.runTransaction(async (tx: any) => {
    const ref = db.doc(DOC_PATH);
    const snap = await tx.get(ref);
    const current = snap.exists ? ((snap.data()?.payload as DatabaseSchema) ?? null) : null;
    const { result, next } = await apply(current);
    tx.set(ref, {
      payload: next,
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
    });
    return result;
  });
}
