'use client';

import React, { useMemo, useState } from 'react';
import { Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { api } from '../api';
import { useLang } from '../LanguageContext';
import { Card, CardHeader, Button, Input, Alert, Badge, EmptyState, Stat } from '../ui';
import type { BootstrapData } from '../types';
import type { RetailerInventoryItem } from '@/lib/types';
import {
  calculateGrossMargin,
  computeSellingFrequency,
  formatMMK,
  priceForTargetMargin,
  recommendPriceByVelocity,
  type VelocityTier,
} from '@/lib/calc/pricing';

const WINDOW_DAYS = 30;

const tierTone: Record<VelocityTier, 'green' | 'blue' | 'amber' | 'slate'> = {
  fast: 'green',
  steady: 'blue',
  slow: 'amber',
  none: 'slate',
};

function TierBadge({ tier, units, days }: { tier: VelocityTier; units: number; days: number }) {
  const Icon = tier === 'fast' ? TrendingUp : tier === 'slow' || tier === 'none' ? TrendingDown : Minus;
  return (
    <div className="flex items-center gap-1.5">
      <Badge tone={tierTone[tier]}>
        <span className="inline-flex items-center gap-1">
          <Icon size={11} /> {tier}
        </span>
      </Badge>
      <span className="text-[11px] text-slate-400">
        {units} sold / {days}d
      </span>
    </div>
  );
}

function PriceRow({
  item,
  data,
  refresh,
  onDone,
}: {
  item: RetailerInventoryItem;
  data: BootstrapData;
  refresh: () => Promise<void>;
  onDone: (m: string) => void;
}) {
  const { t } = useLang();
  const [price, setPrice] = useState(String(item.currentSellingPrice || ''));
  const [margin, setMargin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const frequency = useMemo(
    () => computeSellingFrequency(data.sales, item.id, WINDOW_DAYS),
    [data.sales, item.id]
  );
  const advice = useMemo(
    () =>
      recommendPriceByVelocity({
        wholesaleCost: item.lastSupplierCost,
        currentPrice: item.currentSellingPrice,
        frequency,
        currentStock: item.currentStock,
        lowStockThreshold: item.lowStockThreshold,
      }),
    [item.lastSupplierCost, item.currentSellingPrice, item.currentStock, item.lowStockThreshold, frequency]
  );

  const priceNum = Math.max(0, Math.round(Number(price.replace(/,/g, '')) || 0));
  const liveMargin = calculateGrossMargin(priceNum, item.lastSupplierCost);
  const dirty = priceNum !== item.currentSellingPrice;

  const onMarginChange = (value: string) => {
    setMargin(value);
    const m = Number(value);
    if (Number.isFinite(m) && m > 0 && m < 100 && item.lastSupplierCost > 0) {
      const p = priceForTargetMargin(item.lastSupplierCost, m);
      if (p.isValid) setPrice(String(p.roundedRecommendedPrice));
    }
  };

  const save = async () => {
    setBusy(true);
    setError('');
    const res = await api(`/api/inventory/${item.id}`, { method: 'PATCH', json: { currentSellingPrice: priceNum } });
    setBusy(false);
    if (res.ok) {
      onDone(`${t.success}: ${item.name} → ${formatMMK(priceNum)}`);
      await refresh();
    } else {
      setError(res.message || 'Could not update the price.');
    }
  };

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-3 py-3">
        <div className="font-medium text-slate-800 myanmar">{item.name}</div>
        <div className="text-[11px] text-slate-400">cost {formatMMK(item.lastSupplierCost)} / {item.unit}</div>
      </td>
      <td className="px-3 py-3">
        <TierBadge tier={advice.velocityTier} units={frequency.unitsSold} days={WINDOW_DAYS} />
        {frequency.avgUnitPrice > 0 && (
          <div className="text-[11px] text-slate-400 mt-1">avg sold {formatMMK(frequency.avgUnitPrice)}</div>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          <Input
            className="w-24 text-right"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="numeric"
          />
          <span className="text-xs text-slate-400">MMK</span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
          <span>target margin</span>
          <input
            className="w-12 rounded border border-slate-200 px-1 text-right"
            value={margin}
            onChange={(e) => onMarginChange(e.target.value)}
            inputMode="numeric"
            placeholder="%"
          />
          <span>%</span>
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        <div className={`tabular-nums font-semibold ${(liveMargin.grossMarginPercentage ?? 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
          {liveMargin.grossMarginPercentage === null ? '—' : `${liveMargin.grossMarginPercentage}%`}
        </div>
        <div className="text-[11px] text-slate-400 tabular-nums">
          {formatMMK(liveMargin.grossProfit)} / unit
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="text-sm tabular-nums font-semibold text-brand-700">{formatMMK(advice.recommendedPrice)}</div>
        <div className="text-[11px] text-slate-500 max-w-[16rem]">{advice.rationale}</div>
      </td>
      <td className="px-3 py-3 text-right whitespace-nowrap">
        <div className="flex flex-col items-end gap-1">
          <Button size="sm" variant="secondary" onClick={() => setPrice(String(advice.recommendedPrice))} disabled={!advice.isValid}>
            <Sparkles size={13} /> Use
          </Button>
          <Button size="sm" onClick={save} disabled={busy || !dirty}>{busy ? t.loading : t.save}</Button>
        </div>
        {error && <div className="text-[11px] text-red-600 mt-1">{error}</div>}
      </td>
    </tr>
  );
}

export function PricingPanel({ data, refresh, onDone }: { data: BootstrapData; refresh: () => Promise<void>; onDone: (m: string) => void }) {
  const { t } = useLang();

  const summary = useMemo(() => {
    let marginSum = 0;
    let marginCount = 0;
    let fast = 0;
    for (const item of data.inventory) {
      const m = calculateGrossMargin(item.currentSellingPrice, item.lastSupplierCost).grossMarginPercentage;
      if (m !== null) {
        marginSum += m;
        marginCount += 1;
      }
      const freq = computeSellingFrequency(data.sales, item.id, WINDOW_DAYS);
      if (recommendPriceByVelocity({ wholesaleCost: item.lastSupplierCost, currentPrice: item.currentSellingPrice, frequency: freq }).velocityTier === 'fast') {
        fast += 1;
      }
    }
    return {
      avgMargin: marginCount ? Math.round((marginSum / marginCount) * 10) / 10 : 0,
      fast,
    };
  }, [data.inventory, data.sales]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Pricing advisor"
          subtitle="Your supplier may offer the same price to everyone, but your transport and overheads are your own. Set the final selling price."
        />
        <div className="p-4 grid sm:grid-cols-3 gap-3">
          <Stat label="Items" value={data.inventory.length} />
          <Stat label="Average margin" value={`${summary.avgMargin}%`} tone="good" />
          <Stat label={`Fast movers (${WINDOW_DAYS}d)`} value={summary.fast} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Suggested prices" subtitle="Recommendations are advisory — you decide the final price." />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">{t.product}</th>
                <th className="text-left px-3 py-2">Selling frequency</th>
                <th className="text-left px-3 py-2">{t.sellingPrice}</th>
                <th className="text-right px-3 py-2">{t.grossMargin}</th>
                <th className="text-left px-3 py-2">Recommended</th>
                <th className="text-right px-3 py-2">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {data.inventory.map((item) => (
                <PriceRow key={item.id} item={item} data={data} refresh={refresh} onDone={onDone} />
              ))}
            </tbody>
          </table>
          {data.inventory.length === 0 && <EmptyState>{t.noData}</EmptyState>}
        </div>
      </Card>

      <Alert tone="info">
        Gross margin is profit before operating expenses, taxes and other costs — it is not net profit.
      </Alert>
    </div>
  );
}
