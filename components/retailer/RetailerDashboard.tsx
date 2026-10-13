'use client';

import React, { useState } from 'react';
import { useLang } from '../LanguageContext';
import { Card, CardHeader, Alert, Badge, EmptyState } from '../ui';
import { ConnectionsPanel } from '../ConnectionsPanel';
import { OrdersPanel } from '../OrdersPanel';
import { HistoryPanel } from '../HistoryPanel';
import { ImportPanel } from '../ImportPanel';
import { PriceAlerts } from './PriceAlerts';
import { SupplierComparison } from './SupplierComparison';
import { InventoryPanel } from './InventoryPanel';
import { PlaceOrderPanel } from './PlaceOrderPanel';
import type { BootstrapData } from '../types';
import { formatMMK } from '@/lib/calc/pricing';

type Tab = 'overview' | 'alerts' | 'suppliers' | 'inventory' | 'import' | 'order' | 'orders' | 'connections' | 'history';

export function RetailerDashboard({ data, refresh }: { data: BootstrapData; refresh: () => Promise<void> }) {
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>('overview');
  const [flash, setFlash] = useState('');

  const priceNotifs = data.notifications.filter((n) => n.type === 'price_change' && !n.read);
  const activeConns = data.connections.filter((c) => c.status === 'active');
  const toConfirm = data.orders.filter((o) => (o.status === 'delivered' || o.status === 'ready') && !o.receiptConfirmedAt);
  const lowStock = data.inventory.filter((i) => i.currentStock <= i.lowStockThreshold);

  const onDone = (m: string) => { setFlash(m); setTimeout(() => setFlash(''), 4000); };

  const tabs: Array<[Tab, string]> = [
    ['overview', t.navOverview],
    ['alerts', t.navAlerts],
    ['suppliers', t.navSuppliers],
    ['inventory', t.navInventory],
    ['import', 'Import CSV/Excel'],
    ['order', 'Place order'],
    ['orders', t.navOrders],
    ['connections', t.navConnections],
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
            {key === 'alerts' && priceNotifs.length > 0 && <span className="ml-1 text-xs text-amber-600">({priceNotifs.length})</span>}
            {key === 'orders' && toConfirm.length > 0 && <span className="ml-1 text-xs text-amber-600">({toConfirm.length})</span>}
          </button>
        ))}
      </nav>

      {flash && <Alert tone="success">{flash}</Alert>}

      {tab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Action needed" />
            <div className="p-4 space-y-3 text-sm">
              <button onClick={() => setTab('alerts')} className="w-full flex justify-between items-center hover:bg-slate-50 rounded px-2 py-1">
                <span>Price changes to review</span><Badge tone="amber">{priceNotifs.length}</Badge>
              </button>
              <button onClick={() => setTab('orders')} className="w-full flex justify-between items-center hover:bg-slate-50 rounded px-2 py-1">
                <span>Deliveries to confirm</span><Badge tone="blue">{toConfirm.length}</Badge>
              </button>
              <button onClick={() => setTab('inventory')} className="w-full flex justify-between items-center hover:bg-slate-50 rounded px-2 py-1">
                <span>{t.lowStock}</span><Badge tone="amber">{lowStock.length}</Badge>
              </button>
              <button onClick={() => setTab('connections')} className="w-full flex justify-between items-center hover:bg-slate-50 rounded px-2 py-1">
                <span>{t.connected} suppliers</span><Badge tone="green">{activeConns.length}</Badge>
              </button>
            </div>
          </Card>
          <Card>
            <CardHeader title="Latest supplier prices" />
            <div className="p-4 space-y-3">
              {data.products.length === 0 && <EmptyState>{t.noData}</EmptyState>}
              {data.products.slice(0, 6).map((p) => (
                <div key={p.id} className="text-sm flex justify-between">
                  <span className="myanmar">{p.name}</span>
                  <span className="tabular-nums text-slate-600">{formatMMK(p.currentPrice)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'alerts' && <PriceAlerts data={data} refresh={refresh} />}
      {tab === 'suppliers' && <SupplierComparison data={data} />}
      {tab === 'inventory' && <InventoryPanel data={data} refresh={refresh} onDone={onDone} />}
      {tab === 'import' && <ImportPanel mode="inventory" data={data} refresh={refresh} onDone={onDone} />}
      {tab === 'order' && <PlaceOrderPanel data={data} refresh={refresh} onDone={onDone} />}
      {tab === 'orders' && <OrdersPanel data={data} refresh={refresh} />}
      {tab === 'connections' && <ConnectionsPanel data={data} refresh={refresh} />}
      {tab === 'history' && <HistoryPanel data={data} />}
    </div>
  );
}
