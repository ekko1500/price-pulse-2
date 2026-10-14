'use client';

import React, { useState } from 'react';
import { api } from '../api';
import { useLang } from '../LanguageContext';
import { Card, CardHeader, Button, Field, Input, Select, Textarea, Alert, Badge, EmptyState, Stat } from '../ui';
import type { BootstrapData } from '../types';
import type { PriceUpdateDraft } from '@/lib/types';
import { PRODUCT_UNITS } from '@/lib/types';
import { formatMMK } from '@/lib/calc/pricing';
import { GEMINI_MODELS, DEFAULT_GEMINI_MODEL } from '@/lib/ai/models';

function initialModel(): string {
  try {
    const saved = window.localStorage.getItem('pp_gemini_model');
    if (saved && GEMINI_MODELS.some((m) => m.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_GEMINI_MODEL;
}

function DraftEditor({
  draft,
  data,
  refresh,
  onPublished,
}: {
  draft: PriceUpdateDraft;
  data: BootstrapData;
  refresh: () => Promise<void>;
  onPublished: (msg: string) => void;
}) {
  const { t } = useLang();
  const [form, setForm] = useState({
    productId: draft.productId ?? '',
    productName: draft.productName,
    brand: draft.brand ?? '',
    packageSize: draft.packageSize ?? '',
    unit: draft.unit,
    newPrice: String(draft.newPrice || ''),
    previousPrice: draft.previousPrice ? String(draft.previousPrice) : '',
    effectiveDate: draft.effectiveDate ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const product = data.products.find((p) => p.id === form.productId);
  const existingPrice = product?.currentPrice;
  const newPriceNum = Number(form.newPrice.replace(/,/g, '')) || 0;
  const diff = existingPrice !== undefined ? newPriceNum - existingPrice : null;
  const pct = existingPrice && existingPrice > 0 ? Math.round((diff! / existingPrice) * 1000) / 10 : null;

  const publish = async () => {
    setBusy(true);
    setError('');
    const patch = await api(`/api/prices/drafts/${draft.id}`, {
      method: 'PATCH',
      json: {
        productId: form.productId || null,
        productName: form.productName,
        brand: form.brand,
        packageSize: form.packageSize,
        unit: form.unit,
        newPrice: form.newPrice,
        previousPrice: form.previousPrice,
        effectiveDate: form.effectiveDate,
      },
    });
    if (!patch.ok) {
      setBusy(false);
      setError(patch.message || 'Could not save draft.');
      return;
    }
    const res = await api<{ notifiedBusinessIds: string[] }>(`/api/prices/drafts/${draft.id}/confirm`, { method: 'POST' });
    setBusy(false);
    if (res.ok) {
      const n = res.data?.notifiedBusinessIds?.length ?? 0;
      onPublished(`${t.success}: published at ${formatMMK(newPriceNum)} · ${n} retailer(s) notified.`);
      await refresh();
    } else {
      setError(res.message || 'Publish failed.');
    }
  };

  const discard = async () => {
    await api(`/api/prices/drafts/${draft.id}`, { method: 'DELETE' });
    await refresh();
  };

  return (
    <Card>
      <CardHeader title={`${t.draft} · ${t.confidence}: ${Math.round(draft.confidence * 100)}%`} subtitle={draft.sourceType.replace('_', ' ')} />
      <div className="p-4 grid md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1">{t.originalMessage}</div>
          <pre className="whitespace-pre-wrap break-words text-sm bg-slate-50 border border-slate-200 rounded-lg p-3 myanmar">{draft.rawMessage || '—'}</pre>
          {draft.missingFields.length > 0 && (
            <div className="mt-3"><Alert tone="warning">{t.missingFields}: {draft.missingFields.join(', ')}</Alert></div>
          )}
          {draft.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-amber-700 list-disc list-inside">
              {draft.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <Field label={t.product} hint={draft.candidateProductIds.length > 1 ? 'Multiple possible matches — choose carefully.' : undefined}>
            <Select value={form.productId} onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}>
              <option value="">— select product —</option>
              {data.products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.packageSize ? ` · ${p.packageSize}` : ''}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.newPrice}>
              <Input value={form.newPrice} onChange={(e) => setForm((f) => ({ ...f, newPrice: e.target.value }))} inputMode="numeric" />
            </Field>
            <Field label={t.unit}>
              <Select value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>
                {PRODUCT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.effectiveDate}>
              <Input type="date" value={form.effectiveDate} onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))} />
            </Field>
            <Field label={t.brand}>
              <Input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
            </Field>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 grid grid-cols-3 gap-2">
            <Stat label={t.currentPrice} value={existingPrice !== undefined ? formatMMK(existingPrice) : '—'} />
            <Stat label={t.newPrice} value={formatMMK(newPriceNum)} />
            <Stat
              label={t.priceChange}
              value={diff === null ? '—' : `${diff! >= 0 ? '+' : ''}${formatMMK(diff!)}${pct !== null ? ` (${pct}%)` : ''}`}
              tone={diff !== null && diff! > 0 ? 'bad' : diff !== null && diff! < 0 ? 'good' : 'muted'}
            />
          </div>

          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex gap-2">
            <Button onClick={publish} disabled={busy || !form.productId || !form.newPrice}>{busy ? t.loading : t.publish}</Button>
            <Button variant="secondary" onClick={discard} disabled={busy}>{t.reject}</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function PriceUpdatePanel({ data, refresh, onPublished }: { data: BootstrapData; refresh: () => Promise<void>; onPublished: (m: string) => void }) {
  const { t } = useLang();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [model, setModel] = useState<string>(initialModel);
  const [lastModel, setLastModel] = useState('');

  const [manual, setManual] = useState({ productId: '', newPrice: '', effectiveDate: '', sourceMessage: '' });
  const [manualBusy, setManualBusy] = useState(false);

  const pendingDrafts = data.drafts.filter((d) => d.status === 'pending');
  const activeDraft = pendingDrafts.find((d) => d.id === activeDraftId) || pendingDrafts[0];

  const changeModel = (id: string) => {
    setModel(id);
    try {
      window.localStorage.setItem('pp_gemini_model', id);
    } catch {
      /* ignore */
    }
  };

  const analyse = async () => {
    setBusy(true);
    setError('');
    const res = await api<{ draft: PriceUpdateDraft; usedAi: boolean; model?: string }>('/api/prices/extract', {
      json: { message, model },
    });
    setBusy(false);
    if (res.ok && res.data) {
      setActiveDraftId(res.data.draft.id);
      setLastModel(res.data.model ?? model);
      setMessage('');
      await refresh();
    } else {
      setError(res.message || 'Analysis failed.');
    }
  };

  const publishManual = async () => {
    setManualBusy(true);
    setError('');
    const res = await api<{ notifiedBusinessIds: string[] }>('/api/prices/publish', {
      json: {
        productId: manual.productId,
        newPrice: manual.newPrice,
        effectiveDate: manual.effectiveDate || undefined,
        sourceMessage: manual.sourceMessage || undefined,
      },
    });
    setManualBusy(false);
    if (res.ok) {
      onPublished(`${t.success}: manual price published · ${res.data?.notifiedBusinessIds?.length ?? 0} retailer(s) notified.`);
      setManual({ productId: '', newPrice: '', effectiveDate: '', sourceMessage: '' });
      await refresh();
    } else {
      setError(res.message || 'Publish failed.');
    }
  };

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}

      <Card>
        <CardHeader title={t.navPriceUpdate} subtitle="Paste a supplier message — Gemini extracts the draft, you review before publishing." />
        <div className="p-4 space-y-3">
          <Field label={t.supplierMessage} hint="Burmese, English or mixed. Example: “Starting tomorrow, cooking oil will cost 5,800 MMK per bottle instead of 5,000 MMK.”">
            <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="myanmar" placeholder="Paste the supplier message here…" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3 items-end">
            <Field label="AI model" hint="Choose which Gemini model performs the extraction.">
              <Select value={model} onChange={(e) => changeModel(e.target.value)}>
                {GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </Select>
            </Field>
            <Button onClick={analyse} disabled={busy || message.trim().length < 3}>{busy ? t.loading : t.extract}</Button>
          </div>
          {lastModel && <div className="text-xs text-slate-500">Last extraction used <b>{lastModel}</b>. Falls back to the local parser if the key is missing or over quota.</div>}
        </div>
      </Card>

      {pendingDrafts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {pendingDrafts.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDraftId(d.id)}
              className={`text-xs rounded-full border px-3 py-1 ${activeDraft?.id === d.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600'}`}
            >
              {d.productName || 'draft'} · {formatMMK(d.newPrice)}
            </button>
          ))}
        </div>
      )}

      {activeDraft ? (
        <DraftEditor draft={activeDraft} data={data} refresh={refresh} onPublished={onPublished} />
      ) : (
        <Card><EmptyState>{t.noData}</EmptyState></Card>
      )}

      <Card>
        <CardHeader title="Manual price entry" subtitle="Publish a price directly without AI. Uses the same audit and notification rules." />
        <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <Field label={t.product}>
            <Select value={manual.productId} onChange={(e) => setManual((m) => ({ ...m, productId: e.target.value }))}>
              <option value="">— select —</option>
              {data.products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.packageSize ? ` · ${p.packageSize}` : ''}</option>)}
            </Select>
          </Field>
          <Field label={t.newPrice}>
            <Input value={manual.newPrice} onChange={(e) => setManual((m) => ({ ...m, newPrice: e.target.value }))} inputMode="numeric" />
          </Field>
          <Field label={t.effectiveDate}>
            <Input type="date" value={manual.effectiveDate} onChange={(e) => setManual((m) => ({ ...m, effectiveDate: e.target.value }))} />
          </Field>
          <Button onClick={publishManual} disabled={manualBusy || !manual.productId || !manual.newPrice}>
            {manualBusy ? t.loading : t.publish}
          </Button>
          <div className="sm:col-span-2 lg:col-span-4">
            <Input placeholder="Optional note / source" value={manual.sourceMessage} onChange={(e) => setManual((m) => ({ ...m, sourceMessage: e.target.value }))} />
          </div>
        </div>
      </Card>
    </div>
  );
}
