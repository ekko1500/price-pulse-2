'use client';

import React, { useMemo, useState } from 'react';
import { api } from '../api';
import { useLang } from '../LanguageContext';
import { Card, CardHeader, Button, Field, Input, Select, Alert, EmptyState } from '../ui';
import type { BootstrapData } from '../types';
import { formatMMK } from '@/lib/calc/pricing';

export function PlaceOrderPanel({ data, refresh, onDone }: { data: BootstrapData; refresh: () => Promise<void>; onDone: (m: string) => void }) {
  const { t } = useLang();
  const activeWholesalerIds = useMemo(
    () => data.connections.filter((c) => c.status === 'active').map((c) => c.wholesalerId),
    [data.connections]
  );
  const [wholesalerId, setWholesalerId] = useState(activeWholesalerIds[0] ?? '');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const products = data.products.filter((p) => p.wholesalerId === wholesalerId && p.isActive);
  const nameFor = (id: string) => data.business?.id === id ? data.business.name : (data.directory.find((d) => d.id === id)?.name ?? id);

  const total = products.reduce((s, p) => {
    const q = Number(qty[p.id] ?? 0);
    return s + (Number.isFinite(q) && q > 0 ? q * p.currentPrice : 0);
  }, 0);

  const submit = async () => {
    const items = products
      .map((p) => ({ productId: p.id, quantity: Number(qty[p.id] ?? 0) }))
      .filter((i) => Number.isFinite(i.quantity) && i.quantity > 0);
    if (!wholesalerId || items.length === 0) { setError('Choose a wholesaler and at least one product quantity.'); return; }
    setBusy(true);
    setError('');
    const res = await api('/api/orders', { json: { wholesalerId, items } });
    setBusy(false);
    if (res.ok) { onDone(`${t.success}: order placed.`); setQty({}); await refresh(); }
    else setError(res.message || 'Could not place order.');
  };

  if (activeWholesalerIds.length === 0) {
    return <Card><EmptyState>Connect to a wholesaler first (see {t.navConnections}).</EmptyState></Card>;
  }

  return (
    <Card>
      <CardHeader title="Place an order" subtitle="Prices are snapshotted at the moment you place the order." />
      <div className="p-4 space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label={t.navSuppliers}>
          <Select value={wholesalerId} onChange={(e) => { setWholesalerId(e.target.value); setQty({}); }}>
            {activeWholesalerIds.map((id) => <option key={id} value={id}>{nameFor(id)}</option>)}
          </Select>
        </Field>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">{t.product}</th>
                <th className="text-right px-3 py-2">{t.currentPrice}</th>
                <th className="text-right px-3 py-2">{t.quantity}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 myanmar">{p.name}{p.packageSize ? ` · ${p.packageSize}` : ''}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMMK(p.currentPrice)}</td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      className="w-24 text-right inline-block"
                      value={qty[p.id] ?? ''}
                      onChange={(e) => setQty((q) => ({ ...q, [p.id]: e.target.value }))}
                      inputMode="numeric"
                      placeholder="0"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && <EmptyState>This supplier has no active products.</EmptyState>}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm">{t.total}: <b className="tabular-nums">{formatMMK(total)}</b></div>
          <Button onClick={submit} disabled={busy || products.length === 0}>{busy ? t.loading : 'Place order'}</Button>
        </div>
      </div>
    </Card>
  );
}
