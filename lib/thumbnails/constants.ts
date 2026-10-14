/**
 * Centralised reference-thumbnail rules. Pure and safe to import on the client
 * (the UI uses `normalizeItemKey` to resolve the shared picture for an item).
 */

/** Downvotes on the active picture before users may suggest a better one. */
export const THUMBNAIL_DOWNVOTE_THRESHOLD = 5;
/** Maximum suggestions allowed per item. */
export const THUMBNAIL_MAX_SUGGESTIONS = 5;
/** Maximum suggestions a single user may make per item. */
export const THUMBNAIL_MAX_SUGGESTIONS_PER_USER = 1;
/** A suggestion is promoted to active once it has this many upvotes and beats the active. */
export const THUMBNAIL_PROMOTION_MIN_UPVOTES = 3;

/**
 * Normalise an item name into a stable, shared key. Keeps Unicode letters and
 * numbers (so Myanmar script survives), lowercases, and collapses separators.
 */
export function normalizeItemKey(name: string): string {
  return (name || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
