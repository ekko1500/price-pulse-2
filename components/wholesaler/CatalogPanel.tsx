'use client';

import React, { useState } from 'react';
import { api } from '../api';
import { useLang } from '../LanguageContext';
import { Card, CardHeader, Button, Field, Input, Select, Alert, Badge, EmptyState } from '../ui';
import type { BootstrapData } from '../types';
import type { SupplierProduct } from '@/lib/types';
import { PRODUCT_UNITS } from '@/lib/types';
import { formatMMK } from '@/lib/calc/pricing';

const blank = { name: '', brand: '', category: '', packageSize: '', unit: 'bottle', currentPrice: '', description: '' };

export function CatalogPanel({ data, refresh, onPublished }: { data: BootstrapData; refresh: () => Promise<void>; onPublished: (m: string) => void }) {
  const { t } = useLang();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<SupplierProduct | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setError('');
    const res = await api('/api/products', { json: form });
    setBusy(false);
    if (res.ok) {
      onPublished(t.success);
      setForm(blank);
      await refresh();
    } else setError(res.message || 'Could not create product.');
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    setError('');
    const res = await api(`/api/products/${editing.id}`, {
      method: 'PATCH',
      json: {
        name: editing.name, brand: editing.brand, category: editing.category,
        packageSize: editing.packageSize, unit: editing.unit, description: editing.description,
      },
    });
    setBusy(false);
    if (res.ok) {
      onPublished(t.success);
      setEditing(null);
      await refresh();
    } else setError(res.message || 'Could not update product.');
  };

  const deactivate = async (p: SupplierProduct) => {
    if (!confirm(`Deactivate ${p.name}? History is preserved.`)) return;
    await api(`/api/products/${p.id}`, { method: 'DELETE' });
    await refresh();
  };

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}

      <Card>
        <CardHeader title={t.navCatalog} subtitle={`${data.products.length} product(s)`} />
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
              {data.products.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-800 myanmar">{p.name}</div>
                    {p.brand && <div className="text-xs text-slate-500 myanmar">{p.brand}</div>}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{p.category}</td>
                  <td className="px-4 py-2 text-slate-600">{p.packageSize || '—'} {p.unit}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatMMK(p.currentPrice)}</td>
                  <td className="px-4 py-2">{p.isActive ? <Badge tone="green">active</Badge> : <Badge tone="slate">inactive</Badge>}</td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button className="text-brand-600 hover:underline" onClick={() => setEditing(p)}>edit</button>
                    {p.isActive && <button className="text-red-600 hover:underline" onClick={() => deactivate(p)}>deactivate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.products.length === 0 && <EmptyState>{t.noData}</EmptyState>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Add a product" />
        <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label={t.product}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={t.brand}><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
          <Field label={t.category}><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label={t.packageSize}><Input value={form.packageSize} onChange={(e) => setForm({ ...form, packageSize: e.target.value })} placeholder="e.g. 1 Liter" /></Field>
          <Field label={t.unit}>
            <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {PRODUCT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </Field>
          <Field label={t.currentPrice}><Input value={form.currentPrice} onChange={(e) => setForm({ ...form, currentPrice: e.target.value })} inputMode="numeric" /></Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Button onClick={create} disabled={busy}>{busy ? t.loading : t.save}</Button>
          </div>
        </div>
      </Card>

      {editing && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/30 p-4" onClick={() => setEditing(null)}>
          <Card className="w-full max-w-lg p-5" >
            <div onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold mb-3">Edit product</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label={t.product}><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
                <Field label={t.brand}><Input value={editing.brand ?? ''} onChange={(e) => setEditing({ ...editing, brand: e.target.value })} /></Field>
                <Field label={t.category}><Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></Field>
                <Field label={t.packageSize}><Input value={editing.packageSize ?? ''} onChange={(e) => setEditing({ ...editing, packageSize: e.target.value })} /></Field>
                <Field label={t.unit}>
                  <Select value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value as SupplierProduct['unit'] })}>
                    {PRODUCT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={saveEdit} disabled={busy}>{busy ? t.loading : t.save}</Button>
                <Button variant="secondary" onClick={() => setEditing(null)}>{t.cancel}</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
