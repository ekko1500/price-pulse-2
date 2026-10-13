'use client';

import React from 'react';
import { useLang } from './LanguageContext';
import { Card, CardHeader, EmptyState, Badge } from './ui';
import type { BootstrapData } from './types';
import { formatMMK } from '@/lib/calc/pricing';

export function HistoryPanel({ data }: { data: BootstrapData }) {
  const { t } = useLang();
  const history = [...data.priceHistory].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const bizName = (id: string) => data.business?.id === id ? data.business.name : (data.directory.find((d) => d.id === id)?.name ?? id);

  return (
    <Card>
      <CardHeader title={t.navHistory} subtitle={`${history.length} record(s) · immutable, auditable timeline`} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t.product}</th>
              <th className="text-right px-4 py-2">{t.previousPrice}</th>
              <th className="text-right px-4 py-2">{t.newPrice}</th>
              <th className="text-right px-4 py-2">{t.priceChange}</th>
              <th className="text-left px-4 py-2">{t.effectiveDate}</th>
              <th className="text-left px-4 py-2">Recorded</th>
              <th className="text-left px-4 py-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <div className="myanmar font-medium text-slate-800">{h.productName}</div>
                  <div className="text-xs text-slate-400 myanmar">{bizName(h.wholesalerId)}</div>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMMK(h.oldPrice)}</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">{formatMMK(h.newPrice)}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${h.changeMMK > 0 ? 'text-red-600' : h.changeMMK < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {h.changeMMK >= 0 ? '+' : ''}{formatMMK(h.changeMMK)} ({h.changePercentage}%)
                </td>
                <td className="px-4 py-2">{h.effectiveDate}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{new Date(h.timestamp).toLocaleString()}</td>
                <td className="px-4 py-2"><Badge tone="slate">{h.sourceType.replace('_', ' ')}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.length === 0 && <EmptyState>{t.noData}</EmptyState>}
      </div>
    </Card>
  );
}
