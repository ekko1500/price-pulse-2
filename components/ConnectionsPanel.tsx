'use client';

import React, { useState } from 'react';
import { api } from './api';
import { useLang } from './LanguageContext';
import { Card, CardHeader, Button, Alert, Badge, EmptyState, Select } from './ui';
import type { BootstrapData } from './types';

export function ConnectionsPanel({ data, refresh }: { data: BootstrapData; refresh: () => Promise<void> }) {
  const { t } = useLang();
  const role = data.user.role;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [pickWholesaler, setPickWholesaler] = useState('');

  const pending = data.connections.filter((c) => c.status === 'pending');
  const active = data.connections.filter((c) => c.status === 'active');
  const other = data.connections.filter((c) => c.status === 'rejected' || c.status === 'suspended');

  const act = async (id: string, action: string) => {
    setBusy(id);
    setError('');
    const res = await api(`/api/connections/${id}`, { method: 'PATCH', json: { action } });
    setBusy('');
    if (!res.ok) setError(res.message || 'Action failed.');
    await refresh();
  };

  const request = async () => {
    setError('');
    const res = await api('/api/connections', { json: { wholesalerId: pickWholesaler } });
    if (!res.ok) setError(res.message || 'Request failed.');
    setPickWholesaler('');
    await refresh();
  };

  const nameFor = (c: BootstrapData['connections'][number]) =>
    role === 'wholesaler' ? c.retailerName : c.wholesalerName;

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}

      {role === 'retailer' && (
        <Card>
          <CardHeader title={t.requestConnection} subtitle="Search the wholesaler directory and send a request." />
          <div className="p-4 flex flex-wrap gap-3 items-end">
            <div className="min-w-[240px]">
              <Select value={pickWholesaler} onChange={(e) => setPickWholesaler(e.target.value)}>
                <option value="">— choose a wholesaler —</option>
                {data.directory.map((d) => <option key={d.id} value={d.id}>{d.name}{d.city ? ` · ${d.city}` : ''}</option>)}
              </Select>
            </div>
            <Button onClick={request} disabled={!pickWholesaler}>{t.requestConnection}</Button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title={`${t.pending} (${pending.length})`} />
        <div className="p-4 space-y-2">
          {pending.length === 0 && <EmptyState>{t.noData}</EmptyState>}
          {pending.map((c) => (
            <div key={c.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2">
              <div>
                <div className="text-sm font-medium myanmar">{nameFor(c)}</div>
                <div className="text-xs text-slate-500">{new Date(c.requestedAt).toLocaleString()}</div>
              </div>
              {role === 'wholesaler' ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => act(c.id, 'approve')} disabled={busy === c.id}>{t.approve}</Button>
                  <Button size="sm" variant="danger" onClick={() => act(c.id, 'reject')} disabled={busy === c.id}>{t.reject}</Button>
                </div>
              ) : (
                <Badge tone="amber">{t.pending}</Badge>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title={`${t.connected} (${active.length})`} />
        <div className="p-4 space-y-2">
          {active.length === 0 && <EmptyState>{t.noData}</EmptyState>}
          {active.map((c) => (
            <div key={c.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2">
              <div>
                <div className="text-sm font-medium myanmar">{nameFor(c)}</div>
                <div className="text-xs text-slate-500">{t.connected} · {c.respondedAt ? new Date(c.respondedAt).toLocaleDateString() : ''}</div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => act(c.id, 'disconnect')} disabled={busy === c.id}>Disconnect</Button>
            </div>
          ))}
        </div>
      </Card>

      {other.length > 0 && (
        <Card>
          <CardHeader title="Inactive" />
          <div className="p-4 space-y-2">
            {other.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="myanmar">{nameFor(c)}</span>
                <Badge tone={c.status === 'rejected' ? 'red' : 'slate'}>{c.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
