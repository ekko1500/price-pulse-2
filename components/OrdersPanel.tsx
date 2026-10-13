'use client';

import React, { useState } from 'react';
import { api } from './api';
import { useLang } from './LanguageContext';
import { Card, CardHeader, Button, Alert, Badge, EmptyState } from './ui';
import type { BootstrapData } from './types';
import type { Order, OrderStatus } from '@/lib/types';
import { formatMMK } from '@/lib/calc/pricing';

const statusTone = (s: OrderStatus): 'slate' | 'green' | 'red' | 'amber' | 'blue' => {
  if (s === 'receipt_confirmed') return 'green';
  if (s === 'rejected' || s === 'cancelled') return 'red';
  if (s === 'delivered' || s === 'ready') return 'blue';
  if (s === 'pending') return 'amber';
  return 'slate';
};

export function OrdersPanel({ data, refresh }: { data: BootstrapData; refresh: () => Promise<void> }) {
  const { t } = useLang();
  const role = data.user.role;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const act = async (orderId: string, action: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(orderId);
    setError('');
    const res = await action();
    setBusy('');
    if (!res.ok) setError(res.message || 'Action failed.');
    await refresh();
  };

  const transition = (id: string, status: OrderStatus) =>
    act(id, () => api(`/api/orders/${id}`, { method: 'PATCH', json: { status } }));

  const confirmReceipt = (id: string) =>
    act(id, () => api(`/api/orders/${id}/receipt`, { method: 'POST' }));

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      {data.orders.length === 0 && <Card><EmptyState>{t.noData}</EmptyState></Card>}
      {data.orders.map((o: Order) => (
        <Card key={o.id}>
          <CardHeader
            title={<span>{o.orderNumber} · <span className="text-slate-500 font-normal">{role === 'retailer' ? o.wholesalerName : o.retailerName}</span></span>}
            subtitle={`${new Date(o.placedAt).toLocaleString()} · ${t.payment}: ${o.paymentStatus.replace('_', ' ')}`}
            action={<Badge tone={statusTone(o.status)}>{o.status.replace('_', ' ')}</Badge>}
          />
          <div className="p-4">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="text-left py-1">{t.product}</th>
                  <th className="text-right py-1">{t.quantity}</th>
                  <th className="text-right py-1">Unit price</th>
                  <th className="text-right py-1">{t.total}</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((it, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1 myanmar">{it.productName}</td>
                    <td className="py-1 text-right">{it.quantity} {it.unit}</td>
                    <td className="py-1 text-right tabular-nums">{formatMMK(it.agreedUnitPrice)}</td>
                    <td className="py-1 text-right tabular-nums">{formatMMK(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 font-semibold">
                  <td className="py-1" colSpan={3}>{t.total}</td>
                  <td className="py-1 text-right tabular-nums">{formatMMK(o.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="flex flex-wrap gap-2 mt-3">
              {role === 'wholesaler' && o.status === 'pending' && (
                <>
                  <Button size="sm" onClick={() => transition(o.id, 'accepted')} disabled={busy === o.id}>{t.approve}</Button>
                  <Button size="sm" variant="danger" onClick={() => transition(o.id, 'rejected')} disabled={busy === o.id}>{t.reject}</Button>
                </>
              )}
              {role === 'wholesaler' && o.status === 'accepted' && (
                <Button size="sm" onClick={() => transition(o.id, 'preparing')} disabled={busy === o.id}>Mark preparing</Button>
              )}
              {role === 'wholesaler' && o.status === 'preparing' && (
                <Button size="sm" onClick={() => transition(o.id, 'ready')} disabled={busy === o.id}>Mark ready</Button>
              )}
              {role === 'wholesaler' && o.status === 'ready' && (
                <Button size="sm" onClick={() => transition(o.id, 'delivered')} disabled={busy === o.id}>Mark delivered</Button>
              )}
              {role === 'retailer' && o.status === 'pending' && (
                <Button size="sm" variant="danger" onClick={() => transition(o.id, 'cancelled')} disabled={busy === o.id}>{t.cancel}</Button>
              )}
              {role === 'retailer' && (o.status === 'delivered' || o.status === 'ready') && (
                <Button size="sm" onClick={() => confirmReceipt(o.id)} disabled={busy === o.id}>{t.confirmReceipt}</Button>
              )}
              {o.receiptConfirmedAt && (
                <span className="text-xs text-emerald-700 self-center">
                  {t.confirmReceipt}: {new Date(o.receiptConfirmedAt).toLocaleString()} — stock added once.
                </span>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
