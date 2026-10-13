'use client';

import React, { useState } from 'react';
import { api } from '../api';
import { useLang } from '../LanguageContext';
import { Card, CardHeader, Button, Field, Input, Alert, EmptyState, Stat, Badge } from '../ui';
import type { BootstrapData } from '../types';
import { calculatePriceImpact, formatMMK } from '@/lib/calc/pricing';

export function PriceAlerts({ data, refresh }: { data: BootstrapData; refresh: () => Promise<void> }) {
  const { t } = useLang();
  const [targetMargin, setTargetMargin] = useState(15);
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState('');

  // Price-change notifications for this retailer.
  const priceNotifs = data.notifications
    .filter((n) => n.type === 'price_change')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const rows = priceNotifs
    .map((n) => {
      const productId = (n.data as { productId?: string } | undefined)?.productId;
      const product = data.products.find((p) => p.id === productId);
      if (!product) return null;
      const inv = data.inventory.find(
        (i) => i.supplierProductId === product.id || i.name.toLowerCase().includes(product.name.toLowerCase())
      );
      return { n, product, inv };
    })
    .filter(Boolean) as Array<{ n: (typeof priceNotifs)[number]; product: BootstrapData['products'][number]; inv?: BootstrapData['inventory'][number] }>;

  const applyRecommended = async (inventoryId: string, price: number) => {
    setBusy(inventoryId);
    const res = await api(`/api/inventory/${inventoryId}`, { method: 'PATCH', json: { currentSellingPrice: price } });
    setBusy('');
    if (res.ok) {
      setFlash(`${t.success}: selling price updated to ${formatMMK(price)}.`);
      setTimeout(() => setFlash(''), 4000);
      await refresh();
    }
  };

  return (
    <div className="space-y-4">
      {flash && <Alert tone="success">{flash}</Alert>}
      <Card>
        <CardHeader
          title="Margin intelligence"
          subtitle="Your gross profit is before operating expenses, taxes and other costs — not net profit."
          action={
            <div className="w-40">
              <Field label={t.targetMargin}>
                <Input type="number" min={0} max={95} value={targetMargin} onChange={(e) => setTargetMargin(Number(e.target.value))} />
              </Field>
            </div>
          }
        />
      </Card>

      {rows.length === 0 && <Card><EmptyState>{t.noData}</EmptyState></Card>}

      {rows.map(({ n, product, inv }) => {
        const notifOld = typeof n.data?.oldPrice === 'number' ? n.data.oldPrice : undefined;
        const oldCost = inv?.lastSupplierCost ?? notifOld ?? product.currentPrice;
        const newCost = product.currentPrice;
        const selling = inv?.currentSellingPrice ?? 0;
        const impact = calculatePriceImpact(oldCost, newCost, selling, targetMargin);
        return (
          <Card key={n.id}>
            <CardHeader
              title={<span className="myanmar">{product.name} {product.packageSize ? `· ${product.packageSize}` : ''}</span>}
              subtitle={`${new Date(n.createdAt).toLocaleString()} · effective ${product.lastUpdated.split('T')[0]}`}
              action={<Badge tone={impact.costDiffMMK > 0 ? 'red' : 'green'}>{impact.costChangePercentage}%</Badge>}
            />
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label={t.wholesaleCost} value={`${formatMMK(oldCost)} → ${formatMMK(newCost)}`} tone={impact.costDiffMMK > 0 ? 'bad' : 'good'} />
                <Stat label={t.sellingPrice} value={selling > 0 ? formatMMK(selling) : '—'} />
                <Stat label={t.grossProfit} value={`${formatMMK(impact.after.grossProfit)}`} tone={impact.after.grossProfit < 0 ? 'bad' : 'good'} />
                <Stat label={t.grossMargin} value={impact.after.grossMarginPercentage === null ? '—' : `${impact.after.grossMarginPercentage}%`} tone={(impact.after.grossMarginPercentage ?? 0) < 0 ? 'bad' : 'good'} />
              </div>

              <div className="grid sm:grid-cols-2 gap-3 rounded-lg bg-slate-50 border border-slate-200 p-3">
                <div>
                  <div className="text-xs text-slate-500">{t.grossBefore}</div>
                  <div className="text-sm">{formatMMK(impact.before.grossProfit)} · {impact.before.grossMarginPercentage ?? '—'}%</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{t.grossAfter}</div>
                  <div className="text-sm">{formatMMK(impact.after.grossProfit)} · {impact.after.grossMarginPercentage ?? '—'}%</div>
                </div>
              </div>

              {selling <= 0 && <Alert tone="warning">Set your selling price to compute a margin.</Alert>}

              <div className="flex flex-wrap items-center gap-3">
                <div className="text-sm">
                  {t.recommendedPrice} @ {targetMargin}%: <b className="text-brand-700 tabular-nums">{formatMMK(impact.recommendedNewSellingPrice)}</b>
                </div>
                {inv && impact.recommendedNewSellingPrice > 0 && (
                  <Button size="sm" variant="secondary" disabled={busy === inv.id} onClick={() => applyRecommended(inv.id, impact.recommendedNewSellingPrice)}>
                    Use this selling price
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-500">You decide whether to change your selling price — PricePulse never changes it automatically.</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
