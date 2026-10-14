import { describe, it, expect } from 'vitest';
import { freshData, ctxFor } from './helpers';
import {
  submitThumbnail,
  voteThumbnail,
  activeThumbnail,
  suggestionsFor,
  ThumbnailError,
} from '@/lib/services/thumbnails';
import {
  normalizeItemKey,
  THUMBNAIL_DOWNVOTE_THRESHOLD,
  THUMBNAIL_MAX_SUGGESTIONS_PER_USER,
} from '@/lib/thumbnails/constants';

const ALL_USERS = [
  'user-wholesaler-1',
  'user-wholesaler-2',
  'user-retailer-1',
  'user-retailer-2',
  'user-admin',
];

describe('normalizeItemKey', () => {
  it('normalises case, punctuation and spacing', () => {
    expect(normalizeItemKey('  Cooking Oil (1L)  ')).toBe('cooking oil 1l');
    expect(normalizeItemKey('A/B-C')).toBe('a b c');
  });

  it('keeps Myanmar script and treats equivalent spellings as the same key', () => {
    const a = normalizeItemKey('Cooking Oil (စားသုံးဆီ) 1L');
    const b = normalizeItemKey('cooking oil စားသုံးဆီ 1l');
    expect(a).toBe(b);
  });
});

describe('submitThumbnail', () => {
  it('the first picture for an item becomes active', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-retailer-1');
    const t = submitThumbnail(data, ctx, { itemKey: 'Cooking Oil 1L', label: 'Cooking Oil 1L', url: 'u1' });
    expect(t.status).toBe('active');
    expect(activeThumbnail(data, normalizeItemKey('Cooking Oil 1L'))?.id).toBe(t.id);
  });

  it('blocks suggestions until the active picture reaches the downvote threshold', () => {
    const data = freshData();
    submitThumbnail(data, ctxFor(data, 'user-retailer-1'), { itemKey: 'Rice 5kg', label: 'Rice 5kg', url: 'u1' });
    expect(() =>
      submitThumbnail(data, ctxFor(data, 'user-retailer-2'), { itemKey: 'Rice 5kg', label: 'Rice 5kg', url: 'u2' })
    ).toThrow(ThumbnailError);
  });

  it('opens submissions after enough downvotes and enforces one-per-user', () => {
    const data = freshData();
    const active = submitThumbnail(data, ctxFor(data, 'user-retailer-1'), { itemKey: 'Milk', label: 'Milk', url: 'u0' });
    for (const u of ALL_USERS) voteThumbnail(data, ctxFor(data, u), active.id, -1);
    expect(data.thumbnails[active.id].downvotes).toBeGreaterThanOrEqual(THUMBNAIL_DOWNVOTE_THRESHOLD);

    const s1 = submitThumbnail(data, ctxFor(data, 'user-wholesaler-1'), { itemKey: 'Milk', label: 'Milk', url: 's1' });
    expect(s1.status).toBe('suggested');
    expect(suggestionsFor(data, normalizeItemKey('Milk'))).toHaveLength(1);

    expect(() =>
      submitThumbnail(data, ctxFor(data, 'user-wholesaler-1'), { itemKey: 'Milk', label: 'Milk', url: 's2' })
    ).toThrow(ThumbnailError);
    expect(THUMBNAIL_MAX_SUGGESTIONS_PER_USER).toBe(1);
  });
});

describe('voteThumbnail', () => {
  it('records one vote per user and lets the user change it', () => {
    const data = freshData();
    const ctx = ctxFor(data, 'user-retailer-1');
    const t = submitThumbnail(data, ctx, { itemKey: 'Sugar', label: 'Sugar', url: 'u' });

    voteThumbnail(data, ctx, t.id, 1);
    expect(data.thumbnails[t.id].upvotes).toBe(1);

    voteThumbnail(data, ctx, t.id, -1);
    expect(data.thumbnails[t.id].upvotes).toBe(0);
    expect(data.thumbnails[t.id].downvotes).toBe(1);

    voteThumbnail(data, ctx, t.id, -1);
    expect(data.thumbnails[t.id].downvotes).toBe(1);
  });

  it('promotes the leading suggestion once it out-votes the active picture', () => {
    const data = freshData();
    const active = submitThumbnail(data, ctxFor(data, 'user-retailer-1'), { itemKey: 'Oil', label: 'Oil', url: 'u0' });
    for (const u of ALL_USERS) voteThumbnail(data, ctxFor(data, u), active.id, -1);

    const sugg = submitThumbnail(data, ctxFor(data, 'user-wholesaler-1'), { itemKey: 'Oil', label: 'Oil', url: 's1' });
    for (const u of ['user-wholesaler-1', 'user-retailer-1', 'user-retailer-2']) {
      voteThumbnail(data, ctxFor(data, u), sugg.id, 1);
    }

    const nowActive = activeThumbnail(data, normalizeItemKey('Oil'));
    expect(nowActive?.id).toBe(sugg.id);
    expect(data.thumbnails[active.id].status).toBe('archived');
  });

  it('rejects votes on an archived picture', () => {
    const data = freshData();
    const active = submitThumbnail(data, ctxFor(data, 'user-retailer-1'), { itemKey: 'Tea', label: 'Tea', url: 'u0' });
    for (const u of ALL_USERS) voteThumbnail(data, ctxFor(data, u), active.id, -1);
    const sugg = submitThumbnail(data, ctxFor(data, 'user-wholesaler-1'), { itemKey: 'Tea', label: 'Tea', url: 's1' });
    for (const u of ['user-wholesaler-1', 'user-retailer-1', 'user-retailer-2']) {
      voteThumbnail(data, ctxFor(data, u), sugg.id, 1);
    }
    expect(() => voteThumbnail(data, ctxFor(data, 'user-retailer-2'), active.id, 1)).toThrow(ThumbnailError);
  });
});
