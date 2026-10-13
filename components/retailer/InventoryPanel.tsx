'use client';

import React, { useMemo, useState } from 'react';
import { api } from '../api';
import { useLang } from '../LanguageContext';
import { Card, CardHeader, Button, Field, Input, Select, Alert, Badge, EmptyState, Stat } from '../ui';
import type { BootstrapData } from '../types';
import type { RetailerInventoryItem } from '@/lib/types';
import { calculateGrossMargin, calculateRecommendedSellingPrice, formatMMK } from '@/lib/calc/pricing';

const EXPIRY_WINDOW_DAYS = 30;

function daysUntil(dateISO: string): number {
  const target = new Date(`${dateISO}T00:00:00Z`).getTime();
  return Math.ceil((target - Date.now()) / 86400000);
}

const blank = {
  name: '', category: '', unit: 'piece', packageSize: '', currentStock: '0',
  lowStockThreshold: '10', currentSellingPrice: '0', lastSupplierCost: '0', expiryDate: '',
};

export function InventoryPanel({ data, refresh, onDone }: { data: BootstrapData; refresh: () => Promise<void>; onDone: (m: string) => void }) {
  const { t } = useLang();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<RetailerInventoryItem | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const alerts = useMemo(() => {
    const low = data.inventory.filter((i) => i.currentStock <= i.lowStockThreshold);
    const expiring = data.inventory.filter((i) => i.expiryDate && daysUntil(i.expiryDate) <= EXPIRY_WINDOW_DAYS);
    return { low, expiring };
  }, [data.inventory]);

  const create = async () => {
    setBusy(true);
    setError('');
    const res = await api('/api/inventory', { json: form });
    setBusy(false);
    if (res.ok) { onDone(t.success); setForm(blank); await refresh(); }
    else setError(res.message || 'Could not add item.');
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    const res = await api(`/api/inventory/${editing.id}`, {
      method: 'PATCH',
      json: {
        name: editing.name, category: editing.category, unit: editing.unit, packageSize: editing.packageSize,
        currentStock: editing.currentStock, lowStockThreshold: editing.lowStockThreshold,
        currentSellingPrice: editing.currentSellingPrice, lastSupplierCost: editing.lastSupplierCost, expiryDate: editing.expiryDate,
      },
    });
    setBusy(false);
    if (res.ok) { onDone(t.success); setEditing(null); await refresh(); }
    else setError(res.message || 'Could not update item.');
  };

  const remove = async (i: RetailerInventoryItem) => {
    if (!confirm(`Delete ${i.name}?`)) return;
    await api(`/api/inventory/${i.id}`, { method: 'DELETE' });
    await refresh();
  };

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}

      {(alerts.low.length > 0 || alerts.expiring.length > 0) && (
        <Card>
          <CardHeader title="Alerts" subtitle={`Expiry window: ${EXPIRY_WINDOW_DAYS} days`} />
          <div className="p-4 space-y-2">
            {alerts.low.map((i) => (
              <div key={`l-${i.id}`} className="flex items-center gap-2 text-sm">
                <Badge tone="amber">{t.lowStock}</Badge><span className="myanmar">{i.name}</span>
                <span className="text-xs text-slate-500">{i.currentStock} / threshold {i.lowStockThreshold}</span>
              </div>
            ))}
            {alerts.expiring.map((i) => {
              const d = i.expiryDate ? daysUntil(i.expiryDate) : null;
              return (
                <div key={`e-${i.id}`} className="flex items-center gap-2 text-sm">
                  <Badge tone={d !== null && d < 0 ? 'red' : 'amber'}>{d !== null && d < 0 ? 'Expired' : t.expirySoon}</Badge>
                  <span className="myanmar">{i.name}</span>
                  <span className="text-xs text-slate-500">{i.expiryDate} ({d} days)</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title={t.navInventory} subtitle={`${data.inventory.length} item(s)`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">{t.product}</th>
                <th className="text-right px-4 py-2">Stock</th>
                <th className="text-right px-4 py-2">{t.sellingPrice}</th>
                <th className="text-right px-4 py-2">{t.wholesaleCost}</th>
                <th className="text-right px-4 py-2">{t.grossMargin}</th>
                <th className="text-left px-4 py-2">Expiry</th>
                <th className="text-right px-4 py-2">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {data.inventory.map((i) => {
                const m = calculateGrossMargin(i.currentSellingPrice, i.lastSupplierCost);
                const rec = calculateRecommendedSellingPrice(i.lastSupplierCost, 15, i.currentSellingPrice);
                return (
                  <tr key={i.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 myanmar font-medium text-slate-800">{i.name}</td>
                    <td className={`px-4 py-2 text-right tabular-nums ${i.currentStock <= i.lowStockThreshold ? 'text-amber-700' : ''}`}>{i.currentStock} {i.unit}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatMMK(i.currentSellingPrice)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatMMK(i.lastSupplierCost)}</td>
                    <td className={`px-4 py-2 text-right tabular-nums ${(m.grossMarginPercentage ?? 0) < 0 ? 'text-red-600' : ''}`}>
                      {m.grossMarginPercentage === null ? '—' : `${m.grossMarginPercentage}%`}
                      {rec.isValid && <div className="text-[11px] text-slate-400">rec. {formatMMK(rec.roundedRecommendedPrice)}</div>}
                    </td>
                    <td className="px-4 py-2 text-xs">{i.expiryDate || '—'}</td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button className="text-brand-600 hover:underline" onClick={() => setEditing(i)}>edit</button>
                      <button className="text-red-600 hover:underline" onClick={() => remove(i)}>delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.inventory.length === 0 && <EmptyState>{t.noData}</EmptyState>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Add inventory item" />
        <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label={t.product}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={t.category}><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label={t.unit}><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
          <Field label={t.packageSize}><Input value={form.packageSize} onChange={(e) => setForm({ ...form, packageSize: e.target.value })} /></Field>
          <Field label="Stock"><Input value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })} inputMode="numeric" /></Field>
          <Field label="Low-stock threshold"><Input value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} inputMode="numeric" /></Field>
          <Field label={t.sellingPrice}><Input value={form.currentSellingPrice} onChange={(e) => setForm({ ...form, currentSellingPrice: e.target.value })} inputMode="numeric" /></Field>
          <Field label={t.wholesaleCost}><Input value={form.lastSupplierCost} onChange={(e) => setForm({ ...form, lastSupplierCost: e.target.value })} inputMode="numeric" /></Field>
          <Field label="Expiry date"><Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></Field>
          <div className="flex items-end"><Button onClick={create} disabled={busy || !form.name}>{busy ? t.loading : t.save}</Button></div>
        </div>
      </Card>

      {editing && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/30 p-4" onClick={() => setEditing(null)}>
          <Card className="w-full max-w-lg p-5">
            <div onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold mb-3">Edit item</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label={t.product}><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
                <Field label={t.category}><Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></Field>
                <Field label="Stock"><Input type="number" value={editing.currentStock} onChange={(e) => setEditing({ ...editing, currentStock: Number(e.target.value) })} /></Field>
                <Field label="Low-stock threshold"><Input type="number" value={editing.lowStockThreshold} onChange={(e) => setEditing({ ...editing, lowStockThreshold: Number(e.target.value) })} /></Field>
                <Field label={t.sellingPrice}><Input type="number" value={editing.currentSellingPrice} onChange={(e) => setEditing({ ...editing, currentSellingPrice: Number(e.target.value) })} /></Field>
                <Field label={t.wholesaleCost}><Input type="number" value={editing.lastSupplierCost} onChange={(e) => setEditing({ ...editing, lastSupplierCost: Number(e.target.value) })} /></Field>
                <Field label="Expiry date"><Input type="date" value={editing.expiryDate ?? ''} onChange={(e) => setEditing({ ...editing, expiryDate: e.target.value })} /></Field>
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
