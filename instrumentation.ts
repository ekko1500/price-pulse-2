/**
 * Next.js instrumentation hook.
 *
 * Runs once per server process before it starts handling requests. When the
 * Firestore backend is configured we hydrate the store here so every request
 * observes fully-loaded data without changing the synchronous read surface.
 *
 * The import is kept inside the `NEXT_RUNTIME === 'nodejs'` branch so the edge
 * bundle (which lacks node builtins) never pulls in the store.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { dbStore } = await import('./lib/db/store');
    await dbStore.ready();
  }
}
