import { DatabaseSchema } from '../seed/demo';
import { ItemThumbnail, ThumbnailVote } from '../types';
import { AuthContext } from '../auth/session';
import { makeId } from '../util/id';
import { recordAudit } from './events';
import {
  normalizeItemKey,
  THUMBNAIL_DOWNVOTE_THRESHOLD,
  THUMBNAIL_MAX_SUGGESTIONS,
  THUMBNAIL_MAX_SUGGESTIONS_PER_USER,
  THUMBNAIL_PROMOTION_MIN_UPVOTES,
} from '../thumbnails/constants';

export class ThumbnailError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function activeThumbnail(data: DatabaseSchema, itemKey: string): ItemThumbnail | undefined {
  return Object.values(data.thumbnails).find((t) => t.itemKey === itemKey && t.status === 'active');
}

export function suggestionsFor(data: DatabaseSchema, itemKey: string): ItemThumbnail[] {
  return Object.values(data.thumbnails)
    .filter((t) => t.itemKey === itemKey && t.status === 'suggested')
    .sort((a, b) => b.upvotes - a.upvotes);
}

export function votesByUser(data: DatabaseSchema, userId: string): ThumbnailVote[] {
  return Object.values(data.thumbnailVotes).filter((v) => v.userId === userId);
}

/** Can this user submit a new picture for the item right now? */
export function submissionState(
  data: DatabaseSchema,
  userId: string,
  itemKey: string
): { canSubmit: boolean; reason: string; suggestions: number; byUser: number } {
  const active = activeThumbnail(data, itemKey);
  const suggestions = suggestionsFor(data, itemKey);
  const byUser = suggestions.filter((s) => s.submittedBy === userId).length;

  if (!active) return { canSubmit: true, reason: 'no-active', suggestions: suggestions.length, byUser };
  if (active.downvotes < THUMBNAIL_DOWNVOTE_THRESHOLD) {
    return { canSubmit: false, reason: 'vote-threshold', suggestions: suggestions.length, byUser };
  }
  if (suggestions.length >= THUMBNAIL_MAX_SUGGESTIONS) {
    return { canSubmit: false, reason: 'item-limit', suggestions: suggestions.length, byUser };
  }
  if (byUser >= THUMBNAIL_MAX_SUGGESTIONS_PER_USER) {
    return { canSubmit: false, reason: 'user-limit', suggestions: suggestions.length, byUser };
  }
  return { canSubmit: true, reason: 'open', suggestions: suggestions.length, byUser };
}

/**
 * Promote the best suggestion to active once it has enough support and beats the
 * current active picture. The previous active is archived (kept for history).
 */
function maybePromote(data: DatabaseSchema, itemKey: string): ItemThumbnail | null {
  const best = suggestionsFor(data, itemKey)[0];
  if (!best) return null;
  const active = activeThumbnail(data, itemKey);
  const activeUp = active?.upvotes ?? 0;
  if (best.upvotes < THUMBNAIL_PROMOTION_MIN_UPVOTES || best.upvotes <= activeUp) return null;

  const nowISO = new Date().toISOString();
  if (active) {
    active.status = 'archived';
    data.thumbnails[active.id] = active;
  }
  best.status = 'active';
  best.promotedAt = nowISO;
  data.thumbnails[best.id] = best;
  return best;
}

/** One vote per user per thumbnail; changing a vote updates the tallies. */
export function voteThumbnail(
  data: DatabaseSchema,
  ctx: AuthContext,
  thumbnailId: string,
  value: 1 | -1
): { thumbnail: ItemThumbnail; promoted: ItemThumbnail | null } {
  if (value !== 1 && value !== -1) throw new ThumbnailError('VALIDATION', 'Vote must be +1 or -1.', 422);
  const t = data.thumbnails[thumbnailId];
  if (!t) throw new ThumbnailError('NOT_FOUND', 'Thumbnail not found.', 404);
  if (t.status === 'archived') throw new ThumbnailError('ARCHIVED', 'This picture has been replaced.', 409);

  const nowISO = new Date().toISOString();
  const existing = Object.values(data.thumbnailVotes).find(
    (v) => v.thumbnailId === thumbnailId && v.userId === ctx.user.id
  );

  if (existing && existing.value !== value) {
    if (existing.value === 1) t.upvotes = Math.max(0, t.upvotes - 1);
    else t.downvotes = Math.max(0, t.downvotes - 1);
    existing.value = value;
    data.thumbnailVotes[existing.id] = existing;
    if (value === 1) t.upvotes += 1;
    else t.downvotes += 1;
  } else if (!existing) {
    const vote: ThumbnailVote = {
      id: makeId('tvote'),
      thumbnailId,
      itemKey: t.itemKey,
      userId: ctx.user.id,
      value,
      createdAt: nowISO,
      isDemo: ctx.isDemo,
    };
    data.thumbnailVotes[vote.id] = vote;
    if (value === 1) t.upvotes += 1;
    else t.downvotes += 1;
  }

  data.thumbnails[t.id] = t;
  const promoted = maybePromote(data, t.itemKey);

  recordAudit(data, {
    actorId: ctx.user.id,
    actorName: ctx.business.name,
    actorRole: ctx.user.role,
    action: 'THUMBNAIL_VOTED',
    targetType: 'THUMBNAIL',
    targetId: t.id,
    details: { value, itemKey: t.itemKey },
    isDemo: ctx.isDemo,
  });

  return { thumbnail: data.thumbnails[t.id], promoted };
}

/**
 * Submit a reference picture. The first picture for an item becomes active;
 * later ones are suggestions and only allowed once the active has enough
 * downvotes, within the per-item and per-user limits.
 */
export function submitThumbnail(
  data: DatabaseSchema,
  ctx: AuthContext,
  input: { itemKey: string; label: string; url: string; storagePath?: string }
): ItemThumbnail {
  const itemKey = normalizeItemKey(input.itemKey || input.label);
  if (!itemKey) throw new ThumbnailError('VALIDATION', 'An item name is required.', 422);

  const state = submissionState(data, ctx.user.id, itemKey);
  if (!state.canSubmit) {
    const messages: Record<string, string> = {
      'vote-threshold': `This picture is still accepted; submissions open after ${THUMBNAIL_DOWNVOTE_THRESHOLD} downvotes.`,
      'item-limit': `This item already has the maximum of ${THUMBNAIL_MAX_SUGGESTIONS} suggestions.`,
      'user-limit': 'You have already suggested a picture for this item.',
    };
    throw new ThumbnailError('SUBMISSION_CLOSED', messages[state.reason] || 'Submissions are closed for this item.', 409);
  }

  const isFirst = !activeThumbnail(data, itemKey);
  const nowISO = new Date().toISOString();
  const thumbnail: ItemThumbnail = {
    id: makeId('thumb'),
    itemKey,
    label: input.label || input.itemKey,
    url: input.url,
    storagePath: input.storagePath,
    status: isFirst ? 'active' : 'suggested',
    submittedBy: ctx.user.id,
    submittedByName: ctx.business.name,
    upvotes: 0,
    downvotes: 0,
    createdAt: nowISO,
    isDemo: ctx.isDemo,
  };
  data.thumbnails[thumbnail.id] = thumbnail;

  recordAudit(data, {
    actorId: ctx.user.id,
    actorName: ctx.business.name,
    actorRole: ctx.user.role,
    action: isFirst ? 'THUMBNAIL_CREATED' : 'THUMBNAIL_SUGGESTED',
    targetType: 'THUMBNAIL',
    targetId: thumbnail.id,
    details: { itemKey, label: thumbnail.label },
    isDemo: ctx.isDemo,
  });

  return thumbnail;
}
