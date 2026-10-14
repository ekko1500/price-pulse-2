'use client';

import React, { useMemo, useState } from 'react';
import { ThumbsUp, ThumbsDown, ImagePlus, X } from 'lucide-react';
import { api } from './api';
import { Card, Button, Alert, Badge, EmptyState } from './ui';
import type { BootstrapData } from './types';
import type { ItemThumbnail } from '@/lib/types';
import { submitReferenceImage } from './imageUtils';
import {
  normalizeItemKey,
  THUMBNAIL_DOWNVOTE_THRESHOLD,
  THUMBNAIL_MAX_SUGGESTIONS,
  THUMBNAIL_MAX_SUGGESTIONS_PER_USER,
  THUMBNAIL_PROMOTION_MIN_UPVOTES,
} from '@/lib/thumbnails/constants';

function Thumb({ src, size = 64 }: { src?: string; size?: number }) {
  if (!src) {
    return (
      <div
        className="rounded border border-dashed border-slate-300 bg-slate-50 grid place-items-center text-[10px] text-slate-400"
        style={{ width: size, height: size }}
      >
        no image
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="rounded border border-slate-200 object-cover" style={{ width: size, height: size }} />;
}

function VoteButtons({
  thumbnail,
  myVote,
  busy,
  onVote,
}: {
  thumbnail: ItemThumbnail;
  myVote?: 1 | -1;
  busy: boolean;
  onVote: (value: 1 | -1) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
          myVote === 1 ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
        }`}
        disabled={busy}
        onClick={() => onVote(1)}
      >
        <ThumbsUp size={12} /> {thumbnail.upvotes}
      </button>
      <button
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
          myVote === -1 ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
        }`}
        disabled={busy}
        onClick={() => onVote(-1)}
      >
        <ThumbsDown size={12} /> {thumbnail.downvotes}
      </button>
    </div>
  );
}

export function ThumbnailReference({
  data,
  label,
  onClose,
  refresh,
}: {
  data: BootstrapData;
  label: string;
  onClose: () => void;
  refresh: () => Promise<void>;
}) {
  const itemKey = useMemo(() => normalizeItemKey(label), [label]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const active = data.thumbnails.find((t) => t.itemKey === itemKey && t.status === 'active');
  const suggestions = data.thumbnails
    .filter((t) => t.itemKey === itemKey && t.status === 'suggested')
    .sort((a, b) => b.upvotes - a.upvotes);
  const myVote = (id: string) => data.thumbnailVotes.find((v) => v.thumbnailId === id)?.value;
  const mySuggestions = suggestions.filter((s) => s.submittedBy === data.user.id).length;

  const canSubmit =
    !active ||
    (active.downvotes >= THUMBNAIL_DOWNVOTE_THRESHOLD &&
      suggestions.length < THUMBNAIL_MAX_SUGGESTIONS &&
      mySuggestions < THUMBNAIL_MAX_SUGGESTIONS_PER_USER);

  const submitReason = !active
    ? 'Be the first to add a reference picture.'
    : active.downvotes < THUMBNAIL_DOWNVOTE_THRESHOLD
      ? `Submissions open once the current picture reaches ${THUMBNAIL_DOWNVOTE_THRESHOLD} downvotes (${active.downvotes}/${THUMBNAIL_DOWNVOTE_THRESHOLD}).`
      : suggestions.length >= THUMBNAIL_MAX_SUGGESTIONS
        ? `This item already has the maximum of ${THUMBNAIL_MAX_SUGGESTIONS} suggestions.`
        : mySuggestions >= THUMBNAIL_MAX_SUGGESTIONS_PER_USER
          ? 'You have already suggested a picture for this item.'
          : '';

  const vote = async (thumbnailId: string, value: 1 | -1) => {
    setBusy(thumbnailId);
    setError('');
    const res = await api('/api/thumbnails/vote', { json: { thumbnailId, value } });
    setBusy('');
    if (!res.ok) setError(res.message || 'Could not record your vote.');
    await refresh();
  };

  const submit = async (file: File) => {
    setBusy('submit');
    setError('');
    try {
      await submitReferenceImage({ itemKey, label, file });
      await refresh();
    } catch (e) {
      setError((e as Error).message || 'Could not submit the picture.');
    }
    setBusy('');
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/40 p-4 grid place-items-center" onClick={onClose}>
      <Card className="w-full max-w-2xl p-5" >
        <div onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-slate-800">Reference picture</h3>
              <p className="text-xs text-slate-500 myanmar">{label}</p>
            </div>
            <button className="text-slate-400 hover:text-slate-600" onClick={onClose}><X size={18} /></button>
          </div>

          {error && <div className="mb-3"><Alert tone="error">{error}</Alert></div>}

          {/* Active picture */}
          <div className="flex gap-4">
            <Thumb src={active?.url} size={140} />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">Current reference</span>
                {active ? <Badge tone="green">active</Badge> : <Badge tone="slate">none yet</Badge>}
              </div>
              {active ? (
                <>
                  <div className="text-xs text-slate-500">by {active.submittedByName} · {new Date(active.createdAt).toLocaleDateString()}</div>
                  <VoteButtons thumbnail={active} myVote={myVote(active.id)} busy={busy === active.id} onVote={(v) => vote(active.id, v)} />
                  <div className="text-xs text-slate-500">
                    {active.downvotes >= THUMBNAIL_DOWNVOTE_THRESHOLD
                      ? 'This picture is below the acceptance threshold — suggestions are open.'
                      : `Accepted while downvotes stay under ${THUMBNAIL_DOWNVOTE_THRESHOLD}.`}
                  </div>
                  {(active.category || (active.tags && active.tags.length > 0)) && (
                    <div className="text-xs text-slate-500">
                      {active.category && <span className="mr-2">Category: <b>{active.category}</b></span>}
                      {active.tags && active.tags.length > 0 && <span>Tags: {active.tags.join(', ')}</span>}
                    </div>
                  )}
                  {active.moderation && (
                    <div className="text-[11px] text-slate-400">
                      AI moderation: {active.moderation.status}
                      {active.moderation.model ? ` · ${active.moderation.model}` : ''}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">{submitReason}</p>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-700">Suggest a better picture</div>
              <span className="text-xs text-slate-400">
                {suggestions.length}/{THUMBNAIL_MAX_SUGGESTIONS} suggestions · one per user
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <label
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm ${
                  canSubmit ? 'border-slate-300 hover:bg-slate-50 cursor-pointer' : 'border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <ImagePlus size={15} /> {busy === 'submit' ? 'Uploading…' : 'Choose image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={!canSubmit || busy === 'submit'}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void submit(f);
                    e.target.value = '';
                  }}
                />
              </label>
              {!canSubmit && <span className="text-xs text-slate-500">{submitReason}</span>}
            </div>
          </div>

          {/* Suggestions */}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="text-sm font-medium text-slate-700 mb-2">Suggested pictures</div>
            {suggestions.length === 0 ? (
              <EmptyState>No suggestions yet.</EmptyState>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {suggestions.map((s) => (
                  <div key={s.id} className="rounded-lg border border-slate-200 p-2 flex gap-3">
                    <Thumb src={s.url} size={72} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-slate-500 truncate">by {s.submittedByName}</div>
                      {s.category && <div className="text-[11px] text-slate-500">Category: {s.category}</div>}
                      {s.tags && s.tags.length > 0 && (
                        <div className="text-[11px] text-slate-400 truncate">Tags: {s.tags.join(', ')}</div>
                      )}
                      <div className="text-[11px] text-slate-400 mb-1">
                        Replaces the active picture once it has {THUMBNAIL_PROMOTION_MIN_UPVOTES}+ upvotes and leads.
                      </div>
                      <VoteButtons thumbnail={s} myVote={myVote(s.id)} busy={busy === s.id} onVote={(v) => vote(s.id, v)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end mt-4">
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
