'use client';

import React, { useState } from 'react';
import { useLang } from '../LanguageContext';
import { Card, CardHeader, EmptyState, Badge } from '../ui';
import type { BootstrapData } from '../types';
import type { SupplierProduct } from '@/lib/types';
import { checkComparability, pricePerBaseUnit } from '@/lib/calc/units';
import { formatMMK } from '@/lib/calc/pricing';

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[()·,]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
}

export function SupplierComparison({ data }: { data: BootstrapData }) {
  const { t } = useLang();
  const [selectedItem, setSelectedItem] = useState(data.inventory[0]?.id ?? '');

  const item = data.inventory.find((i) => i.id === selectedItem);

  const candidates = React.useMemo(() => {
    if (!item) return [] as SupplierProduct[];
    const itemTokens = new Set(tokenize(item.name));
    return data.products
      .filter((p) => p.isActive)
      .map((p) => {
        const overlap = tokenize(`${p.name} ${p.category} ${p.brand ?? ''}`).filter((w) => itemTokens.has(w)).length;
        const sameCat = p.category.toLowerCase() === item.category.toLowerCase();
        return { p, score: overlap + (sameCat ? 1 : 0) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p);
  }, [data.products, item]);

  if (data.inventory.length === 0) {
    return <Card><EmptyState>{t.noData}</EmptyState></Card>;
  }

  // Determine cheapest comparable candidate per base unit.
  let cheapestId: string | null = null;
  let cheapestPerBase = Infinity;
  const comparability: Record<string, ReturnType<typeof checkComparability>> = {};
  if (item) {
    for (const c of candidates) {
      const cmp = checkComparability({ unit: item.unit, packageSize: item.packageSize }, { unit: c.unit, packageSize: c.packageSize });
      comparability[c.id] = cmp;
      if (cmp.comparable) {
        const per = pricePerBaseUnit(c.currentPrice, c.packageSize, c.unit);
        if (per !== null && per < cheapestPerBase) { cheapestPerBase = per; cheapestId = c.id; }
      }
    }
  }

  const supplierName = (id: string) => data.business?.id === id ? data.business.name : (data.directory.find((d) => d.id === id)?.name ?? id);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t.navSuppliers} subtitle="Compare connected suppliers. Cheapest is informational only — nothing is auto-selected." />
        <div className="p-4">
          <select
            value={selectedItem}
            onChange={(e) => setSelectedItem(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            {data.inventory.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
      </Card>

      {item && (
        <Card>
          <CardHeader title={`${item.name}`} subtitle={`Your unit: ${item.packageSize ?? '—'} ${item.unit}`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">{t.navSuppliers}</th>
                  <th className="text-left px-4 py-2">{t.packageSize} / {t.unit}</th>
                  <th className="text-right px-4 py-2">{t.currentPrice}</th>
                  <th className="text-left px-4 py-2">Last updated</th>
                  <th className="text-left px-4 py-2">Comparison</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const cmp = comparability[c.id];
                  const per = pricePerBaseUnit(c.currentPrice, c.packageSize, c.unit);
                  return (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 myanmar">
                        {supplierName(c.wholesalerId)}
                        {c.id === cheapestId && <span className="ml-2"><Badge tone="green">{t.cheapest}</Badge></span>}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{c.packageSize ?? '—'} {c.unit}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatMMK(c.currentPrice)}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{new Date(c.lastUpdated).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-xs">
                        {cmp?.comparable ? (
                          <span className="text-emerald-700">{per !== null ? `${formatMMK(Math.round(per))} / ${cmp.baseUnit}` : 'comparable'}</span>
                        ) : (
                          <span className="text-amber-700">{t.cannotCompare}: {cmp?.reason}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {candidates.length === 0 && <EmptyState>{t.noData}</EmptyState>}
          </div>
        </Card>
      )}
    </div>
  );
}
