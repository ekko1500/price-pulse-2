'use client';

import React, { useState } from 'react';
import { api } from '../api';
import { useLang } from '../LanguageContext';
import { Card, CardHeader, Button, Field, Input, Select, Textarea, Alert, Badge, Modal, EmptyState } from '../ui';
import { ImagePicker } from '../ImagePicker';
import type { BootstrapData } from '../types';
import type { SupplierProduct } from '@/lib/types';
import { PRODUCT_UNITS } from '@/lib/types';
import { formatMMK } from '@/lib/calc/pricing';
import { searchProducts } from '@/lib/services/productSearch';

const blank = {
  name: '', itemId: '', sku: '', nameEn: '', nameMy: '', colloquialNameMy: '',
  brand: '', category: '', packageSize: '', unit: 'bottle', currentPrice: '',
  description: '', imageData: '', searchKeywords: '', aliases: '',
};

type FormState = typeof blank;

function productToForm(p: SupplierProduct): FormState {
  return {
    name: p.name,
    itemId: p.itemId ?? '',
    sku: p.sku ?? '',
    nameEn: p.nameEn ?? '',
    nameMy: p.nameMy ?? '',
    colloquialNameMy: p.colloquialNameMy ?? '',
    brand: p.brand ?? '',
    category: p.category,
    packageSize: p.packageSize ?? '',
    unit: p.unit,
    currentPrice: String(p.currentPrice),
    description: p.description ?? '',
    imageData: p.imageData ?? '',
    searchKeywords: (p.searchKeywords ?? []).join(', '),
    aliases: (p.aliases ?? []).join(', '),
  };
}

interface ScannedProduct {
  name: string;
  nameEn?: string;
  nameMy?: string;
  colloquialNameMy?: string;
  brand?: string;
  category: string;
  packageSize?: string;
  unit: SupplierProduct['unit'];
  sku?: string;
  currentPrice?: number;
  description?: string;
  searchKeywords?: string[];
  aliases?: string[];
  confidence: number;
  notes?: string;
}

export function CatalogPanel({ data, refresh, onPublished }: { data: BootstrapData; refresh: () => Promise<void>; onPublished: (m: string) => void }) {
  const { t } = useLang();
  const [form, setForm] = useState<FormState>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [showScan, setShowScan] = useState(false);
  const [scanImage, setScanImage] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState('');

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const imageLabels = {
    uploadFromFile: t.uploadFromFile,
    useCamera: t.useCamera,
    capture: t.capture,
    cancel: t.cancel,
    removeImage: t.removeImage,
    cameraUnavailable: t.cameraUnavailable,
    hint: t.imageHint,
  };

  const openAdd = () => {
    setForm(blank);
    setEditingId(null);
    setError('');
    setShowForm(true);
  };

  const openEdit = (p: SupplierProduct) => {
    setForm(productToForm(p));
    setEditingId(p.id);
    setError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setError('');
  };

  const save = async () => {
    setBusy(true);
    setError('');
    const res = editingId
      ? await api(`/api/products/${editingId}`, { method: 'PATCH', json: form })
      : await api('/api/products', { json: form });
    setBusy(false);
    if (res.ok) {
      onPublished(t.success);
      setForm(blank);
      setEditingId(null);
      setShowForm(false);
      await refresh();
    } else setError(res.message || 'Could not save product.');
  };

  const openScan = () => {
    setScanImage('');
    setScanError('');
    setShowScan(true);
  };

  const generate = async () => {
    if (!scanImage) return;
    setScanBusy(true);
    setScanError('');
    const res = await api<{ product: ScannedProduct }>('/api/products/scan', { json: { image: scanImage } });
    setScanBusy(false);
    const scanned = res.data?.product;
    if (res.ok && scanned) {
      setForm((f) => ({
        ...f,
        name: scanned.name || f.name,
        nameEn: scanned.nameEn ?? f.nameEn,
        nameMy: scanned.nameMy ?? f.nameMy,
        colloquialNameMy: scanned.colloquialNameMy ?? f.colloquialNameMy,
        brand: scanned.brand ?? f.brand,
        category: scanned.category || f.category,
        packageSize: scanned.packageSize ?? f.packageSize,
        unit: scanned.unit || f.unit,
        sku: scanned.sku ?? f.sku,
        currentPrice: scanned.currentPrice != null ? String(scanned.currentPrice) : f.currentPrice,
        description: scanned.description ?? f.description,
        searchKeywords: scanned.searchKeywords?.length ? scanned.searchKeywords.join(', ') : f.searchKeywords,
        aliases: scanned.aliases?.length ? scanned.aliases.join(', ') : f.aliases,
        imageData: scanImage,
      }));
      setShowScan(false);
    } else {
      setScanError(res.message || t.aiScanFailed);
    }
  };

  const deactivate = async (p: SupplierProduct) => {
    if (!confirm(`Deactivate ${p.name}? History is preserved.`)) return;
    await api(`/api/products/${p.id}`, { method: 'DELETE' });
    await refresh();
  };

  const filtered = searchProducts(data.products, query);

  return (
    <div className="space-y-5">
      {error && !showForm && <Alert tone="error">{error}</Alert>}

      <Card>
        <CardHeader
          title={t.navCatalog}
          subtitle={`${data.products.length} product(s)`}
          action={
            <div className="flex items-center gap-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPlaceholder} className="w-36 sm:w-52" />
              <Button size="sm" onClick={openAdd}>+ {t.addProduct}</Button>
            </div>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">{t.product}</th>
                <th className="text-left px-4 py-2">{t.category}</th>
                <th className="text-left px-4 py-2">{t.packageSize}</th>
                <th className="text-right px-4 py-2">{t.currentPrice}</th>
                <th className="text-left px-4 py-2">{t.status}</th>
                <th className="text-right px-4 py-2">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      {p.imageData ? (
                        <img src={p.imageData} alt="" className="h-10 w-10 rounded object-cover border border-slate-200" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-slate-100 grid place-items-center text-[10px] text-slate-400">—</div>
                      )}
                      <div>
                        <div className="font-medium text-slate-800 myanmar">{p.name}</div>
                        <div className="text-xs text-slate-500 myanmar">
                          {[p.nameMy, p.colloquialNameMy].filter(Boolean).join(' · ')}
                          {p.sku ? ` · ${p.sku}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{p.category}</td>
                  <td className="px-4 py-2 text-slate-600">{p.packageSize || '—'} {p.unit}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatMMK(p.currentPrice)}</td>
                  <td className="px-4 py-2">{p.isActive ? <Badge tone="green">active</Badge> : <Badge tone="slate">inactive</Badge>}</td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button className="text-brand-600 hover:underline" onClick={() => openEdit(p)}>edit</button>
                    {p.isActive && <button className="text-red-600 hover:underline" onClick={() => deactivate(p)}>deactivate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.products.length === 0 && <EmptyState>{t.noData}</EmptyState>}
          {data.products.length > 0 && filtered.length === 0 && <EmptyState>{t.noMatch}</EmptyState>}
        </div>
      </Card>

      {showForm && (
        <Modal
          title={editingId ? t.editProduct : t.addProduct}
          onClose={closeForm}
          headerAction={<Button size="sm" variant="secondary" onClick={openScan}>{t.useAI}</Button>}
          footer={
            <>
              <Button variant="secondary" onClick={closeForm}>{t.cancel}</Button>
              <Button onClick={save} disabled={busy}>{busy ? t.loading : t.save}</Button>
            </>
          }
        >
          {error && <div className="mb-3"><Alert tone="error">{error}</Alert></div>}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t.product}><Input value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label={t.brand}><Input value={form.brand} onChange={(e) => set({ brand: e.target.value })} /></Field>
            <Field label={t.nameEn}><Input value={form.nameEn} onChange={(e) => set({ nameEn: e.target.value })} /></Field>
            <Field label={t.nameMy}><Input value={form.nameMy} onChange={(e) => set({ nameMy: e.target.value })} className="myanmar" /></Field>
            <Field label={t.colloquialNameMy}><Input value={form.colloquialNameMy} onChange={(e) => set({ colloquialNameMy: e.target.value })} className="myanmar" /></Field>
            <Field label={t.category}><Input value={form.category} onChange={(e) => set({ category: e.target.value })} /></Field>
            <Field label={t.itemId}><Input value={form.itemId} onChange={(e) => set({ itemId: e.target.value })} placeholder="e.g. BAT-777-AAA-4P" /></Field>
            <Field label={t.sku}><Input value={form.sku} onChange={(e) => set({ sku: e.target.value })} placeholder="e.g. 6921234567890" /></Field>
            <Field label={t.packageSize}><Input value={form.packageSize} onChange={(e) => set({ packageSize: e.target.value })} placeholder="e.g. 1 Liter" /></Field>
            <Field label={t.unit}>
              <Select value={form.unit} onChange={(e) => set({ unit: e.target.value })}>
                {PRODUCT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>
            {!editingId && (
              <Field label={t.currentPrice}><Input value={form.currentPrice} onChange={(e) => set({ currentPrice: e.target.value })} inputMode="numeric" /></Field>
            )}
            <div className="sm:col-span-2">
              <Field label={t.aliases} hint={t.commaSeparated}><Textarea rows={2} value={form.aliases} onChange={(e) => set({ aliases: e.target.value })} className="myanmar" /></Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={t.searchKeywords} hint={t.commaSeparated}><Textarea rows={2} value={form.searchKeywords} onChange={(e) => set({ searchKeywords: e.target.value })} className="myanmar" /></Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={t.description}><Textarea rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} className="myanmar" /></Field>
            </div>
            <div className="sm:col-span-2">
              <span className="block text-sm font-medium text-slate-700 mb-1">{t.productImage}</span>
              <ImagePicker value={form.imageData} onChange={(v) => set({ imageData: v })} labels={imageLabels} />
            </div>
          </div>
        </Modal>
      )}

      {showScan && (
        <Modal
          title={t.useAI}
          onClose={() => { setShowScan(false); setScanError(''); }}
          footer={
            <>
              <Button variant="secondary" onClick={() => { setShowScan(false); setScanError(''); }}>{t.cancel}</Button>
              <Button onClick={generate} disabled={scanBusy || !scanImage}>{scanBusy ? t.loading : t.generate}</Button>
            </>
          }
        >
          {scanError && <div className="mb-3"><Alert tone="error">{scanError}</Alert></div>}
          <p className="text-xs text-slate-500 mb-3">{t.scanHint}</p>
          <ImagePicker value={scanImage} onChange={setScanImage} labels={imageLabels} autoStart />
        </Modal>
      )}
    </div>
  );
}
