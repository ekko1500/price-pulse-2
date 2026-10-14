'use client';

import React, { useState } from 'react';
import { useLang } from '../LanguageContext';
import { Card, CardHeader, Alert, Badge, EmptyState, Button } from '../ui';
import { PriceUpdatePanel } from './PriceUpdatePanel';
import { CatalogPanel } from './CatalogPanel';
import { ImportPanel } from '../ImportPanel';
import { ConnectionsPanel } from '../ConnectionsPanel';
import { OrdersPanel } from '../OrdersPanel';
import { HistoryPanel } from '../HistoryPanel';
import { PosTerminal } from '../pos/PosTerminal';
import { SalesHistoryPanel } from '../pos/SalesHistoryPanel';
import type { BootstrapData } from '../types';
import { formatMMK } from '@/lib/calc/pricing';

type Tab = 'overview' | 'price' | 'catalog' | 'import' | 'connections' | 'orders' | 'history' | 'sell' | 'sales';

export function WholesalerDashboard({ data, refresh }: { data: BootstrapData; refresh: () => Promise<void> }) {
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>('overview');
  const [flash, setFlash] = useState('');

  const pendingDrafts = data.drafts.filter((d) => d.status === 'pending');
  const pendingConns = data.connections.filter((c) => c.status === 'pending');
  const actionableOrders = data.orders.filter((o) => ['pending', 'accepted', 'preparing', 'ready'].includes(o.status));
  const recent = [...data.priceHistory].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);

  const onDone = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(''), 4000);
  };

  const tabs: Array<[Tab, string]> = [
    ['overview', t.navOverview],
    ['price', t.navPriceUpdate],
    ['catalog', t.navCatalog],
    ['import', 'Import CSV/Excel'],
    ['sell', t.navSell],
    ['sales', t.navSales],
    ['connections', t.navConnections],
    ['orders', t.navOrders],
    ['history', t.navHistory],
  ];

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-1">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium ${
              tab === key ? 'bg-white border border-slate-200 border-b-white text-brand-700' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
            {key === 'price' && pendingDrafts.length > 0 && <span className="ml-1 text-xs text-amber-600">({pendingDrafts.length})</span>}
            {key === 'connections' && pendingConns.length > 0 && <span className="ml-1 text-xs text-amber-600">({pendingConns.length})</span>}
            {key === 'orders' && actionableOrders.length > 0 && <span className="ml-1 text-xs text-amber-600">({actionableOrders.length})</span>}
          </button>
        ))}
      </nav>

      {flash && <Alert tone="success">{flash}</Alert>}

      {tab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Action needed" />
            <div className="p-4 space-y-3 text-sm">
              <button onClick={() => setTab('price')} className="w-full flex justify-between items-center hover:bg-slate-50 rounded px-2 py-1">
                <span>{t.navPriceUpdate} awaiting review</span><Badge tone="amber">{pendingDrafts.length}</Badge>
              </button>
              <button onClick={() => setTab('connections')} className="w-full flex justify-between items-center hover:bg-slate-50 rounded px-2 py-1">
                <span>Connection requests</span><Badge tone="amber">{pendingConns.length}</Badge>
              </button>
              <button onClick={() => setTab('orders')} className="w-full flex justify-between items-center hover:bg-slate-50 rounded px-2 py-1">
                <span>Orders to process</span><Badge tone="blue">{actionableOrders.length}</Badge>
              </button>
            </div>
          </Card>
          <Card>
            <CardHeader title="Recent price changes" />
            <div className="p-4 space-y-3">
              {recent.length === 0 && <EmptyState>{t.noData}</EmptyState>}
              {recent.map((h) => (
                <div key={h.id} className="text-sm flex justify-between">
                  <span className="myanmar">{h.productName}</span>
                  <span className="tabular-nums text-slate-600">{formatMMK(h.oldPrice)} → <b>{formatMMK(h.newPrice)}</b></span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'price' && <PriceUpdatePanel data={data} refresh={refresh} onPublished={onDone} />}
      {tab === 'catalog' && <CatalogPanel data={data} refresh={refresh} onPublished={onDone} />}
      {tab === 'import' && <ImportPanel mode="prices" data={data} refresh={refresh} onDone={onDone} />}
      {tab === 'sell' && <PosTerminal data={data} refresh={refresh} />}
      {tab === 'sales' && <SalesHistoryPanel data={data} refresh={refresh} />}
      {tab === 'connections' && <ConnectionsPanel data={data} refresh={refresh} />}
      {tab === 'orders' && <OrdersPanel data={data} refresh={refresh} />}
      {tab === 'history' && <HistoryPanel data={data} />}
    </div>
  );
}
