'use client';

import React, { useMemo, useState } from 'react';
import { FileDown, XCircle } from 'lucide-react';
import { api } from '../api';
import { useLang } from '../LanguageContext';
import { Card, CardHeader, Button, Alert, Badge, EmptyState, Stat } from '../ui';
import type { BootstrapData } from '../types';
import type { Sale } from '@/lib/types';
import { formatMMK } from '@/lib/calc/pricing';
import { exportSaleReceiptPdf } from './receiptPdf';

export function SalesHistoryPanel({ data, refresh }: { data: BootstrapData; refresh: () => Promise<void> }) {
  const { t, lang } = useLang();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [exporting, setExporting] = useState('');

  const sales = useMemo(
    () => [...data.sales].sort((a, b) => (a.soldAt < b.soldAt ? 1 : -1)),
    [data.sales]
  );
  const revenue = sales.filter((s) => s.status === 'completed').reduce((sum, s) => sum + s.total, 0);
  const today = new Date().toDateString();
  const todayRevenue = sales
    .filter((s) => s.status === 'completed' && new Date(s.soldAt).toDateString() === today)
    .reduce((sum, s) => sum + s.total, 0);

  const doVoid = async (sale: Sale) => {
    if (!confirm(`Void ${sale.receiptNumber}? Stock sold will be returned to inventory.`)) return;
    setBusy(sale.id);
    setError('');
    const res = await api(`/api/sales/${sale.id}`, { method: 'PATCH' });
    setBusy('');
    if (!res.ok) setError(res.message || 'Could not void the sale.');
    await refresh();
  };

  const doExport = async (sale: Sale) => {
    setExporting(sale.id);
    setError('');
    try {
      await exportSaleReceiptPdf(sale, data.business, lang);
    } catch (e) {
      setError((e as Error).message || 'Could not export the PDF.');
    }
    setExporting('');
  };

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <Stat label="All-time sales" value={sales.length} />
        </Card>
        <Card className="p-4">
          <Stat label="Revenue (completed)" value={formatMMK(revenue)} tone="good" />
        </Card>
        <Card className="p-4">
          <Stat label="Today" value={formatMMK(todayRevenue)} />
        </Card>
      </div>

      <Card>
        <CardHeader title={t.navSales} subtitle={`${sales.length} receipt(s)`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">Receipt</th>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">{t.customerName}</th>
                <th className="text-right px-4 py-2">{t.total}</th>
                <th className="text-left px-4 py-2">{t.paymentMethod}</th>
                <th className="text-left px-4 py-2">{t.status}</th>
                <th className="text-right px-4 py-2">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-semibold text-brand-700">{s.receiptNumber}</td>
                  <td className="px-4 py-2 text-slate-600">{new Date(s.soldAt).toLocaleString()}</td>
                  <td className="px-4 py-2 myanmar">{s.customerName || '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">{formatMMK(s.total)}</td>
                  <td className="px-4 py-2 text-slate-600">{s.paymentMethod}</td>
                  <td className="px-4 py-2">
                    {s.status === 'voided' ? <Badge tone="red">voided</Badge> : <Badge tone="green">completed</Badge>}
                  </td>
                  <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                    <button
                      className="inline-flex items-center gap-1 text-brand-600 hover:underline disabled:opacity-50"
                      onClick={() => doExport(s)}
                      disabled={exporting === s.id}
                    >
                      <FileDown size={14} /> PDF
                    </button>
                    {s.status === 'completed' && (
                      <button
                        className="inline-flex items-center gap-1 text-red-600 hover:underline disabled:opacity-50"
                        onClick={() => doVoid(s)}
                        disabled={busy === s.id}
                      >
                        <XCircle size={14} /> {t.voidSale}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.length === 0 && <EmptyState>{t.noSales}</EmptyState>}
        </div>
      </Card>
    </div>
  );
}