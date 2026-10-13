'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useLang } from '../LanguageContext';
import { Card, CardHeader, Button, Alert, Badge, EmptyState } from '../ui';
import type { BootstrapData } from '../types';
import type { PublicUser, Business, SupplierConnection } from '@/lib/types';

interface AdminUser extends PublicUser {
  businessName: string;
  connectionCount: number;
}

interface AdminData {
  users: AdminUser[];
  businesses: Business[];
  connections: SupplierConnection[];
}

type Tab = 'accounts' | 'connections' | 'audit' | 'demo';

export function AdminDashboard({ data, refresh }: { data: BootstrapData; refresh: () => Promise<void> }) {
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>('accounts');
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const res = await api<AdminData>('/api/admin/users');
    if (res.ok && res.data) setAdmin(res.data);
    else setError(res.message || 'Could not load accounts.');
  }, []);

  useEffect(() => { load(); }, [load]);

  const notify = (m: string) => { setFlash(m); setTimeout(() => setFlash(''), 5000); };

  const toggleActive = async (u: AdminUser) => {
    setBusy(u.id);
    const res = await api(`/api/admin/users/${u.id}`, { method: 'PATCH', json: { isActive: !u.isActive } });
    setBusy('');
    if (res.ok) { notify(`${u.username} ${!u.isActive ? 'activated' : 'deactivated'}.`); await load(); }
    else setError(res.message || 'Action failed.');
  };

  const issueReset = async (u: AdminUser) => {
    setBusy(u.id);
    const res = await api<{ resetToken: string; expiresAt: string }>(`/api/admin/users/${u.id}/reset`, { method: 'POST' });
    setBusy('');
    if (res.ok && res.data) {
      notify(`One-time reset token for ${u.username} (expires ${new Date(res.data.expiresAt).toLocaleTimeString()}): ${res.data.resetToken}`);
    } else setError(res.message || 'Could not issue reset token.');
  };

  const resetDemo = async () => {
    if (!confirm('Reset the isolated demo dataset? Only demo records are affected.')) return;
    setBusy('demo');
    const res = await api('/api/demo/reset', { method: 'POST' });
    setBusy('');
    if (res.ok) { notify('Demo dataset reset.'); await refresh(); await load(); }
    else setError(res.message || 'Reset failed.');
  };

  const tabs: Array<[Tab, string]> = [
    ['accounts', 'Accounts'],
    ['connections', t.navConnections],
    ['audit', 'Audit log'],
    ['demo', 'Demo data'],
  ];

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 border-b border-slate-200 pb-1">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium ${tab === key ? 'bg-white border border-slate-200 border-b-white text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </nav>

      {error && <Alert tone="error">{error}</Alert>}
      {flash && <Alert tone="success" >{flash}</Alert>}

      {tab === 'accounts' && (
        <Card>
          <CardHeader title="Accounts" subtitle="Admins cannot be self-registered. Password resets use one-time tokens — admins never see passwords." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">User</th>
                  <th className="text-left px-4 py-2">Business</th>
                  <th className="text-left px-4 py-2">Role</th>
                  <th className="text-left px-4 py-2">Connections</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-right px-4 py-2">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {admin?.users.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{u.username}{u.isDemo && <span className="ml-2"><Badge tone="slate">demo</Badge></span>}</td>
                    <td className="px-4 py-2 myanmar">{u.businessName}</td>
                    <td className="px-4 py-2"><Badge tone={u.role === 'admin' ? 'blue' : u.role === 'wholesaler' ? 'green' : 'slate'}>{u.role}</Badge></td>
                    <td className="px-4 py-2">{u.connectionCount}</td>
                    <td className="px-4 py-2">{u.isActive ? <Badge tone="green">active</Badge> : <Badge tone="red">disabled</Badge>}</td>
                    <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                      <button className="text-brand-600 hover:underline" disabled={busy === u.id} onClick={() => issueReset(u)}>reset token</button>
                      {u.id !== data.user.id && (
                        <button className={`hover:underline ${u.isActive ? 'text-red-600' : 'text-emerald-700'}`} disabled={busy === u.id} onClick={() => toggleActive(u)}>
                          {u.isActive ? 'deactivate' : 'activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!admin && <EmptyState>{t.loading}</EmptyState>}
          </div>
        </Card>
      )}

      {tab === 'connections' && (
        <Card>
          <CardHeader title={`${t.navConnections} (${data.connections.length})`} />
          <div className="p-4 space-y-2">
            {data.connections.length === 0 && <EmptyState>{t.noData}</EmptyState>}
            {data.connections.map((c) => (
              <div key={c.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <span className="myanmar">{c.wholesalerName} ↔ {c.retailerName}</span>
                <Badge tone={c.status === 'active' ? 'green' : c.status === 'pending' ? 'amber' : c.status === 'rejected' ? 'red' : 'slate'}>{c.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'audit' && (
        <Card>
          <CardHeader title={`Audit log (${data.auditLogs.length})`} subtitle="Append-only record of security and business events." />
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2">Time</th>
                  <th className="text-left px-4 py-2">Actor</th>
                  <th className="text-left px-4 py-2">Action</th>
                  <th className="text-left px-4 py-2">Target</th>
                  <th className="text-left px-4 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {[...data.auditLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-4 py-1.5 whitespace-nowrap text-slate-500">{new Date(a.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-1.5 myanmar">{a.actorName} <span className="text-slate-400">({a.actorRole})</span></td>
                    <td className="px-4 py-1.5 font-medium">{a.action}</td>
                    <td className="px-4 py-1.5 text-slate-500">{a.targetType}</td>
                    <td className="px-4 py-1.5 text-slate-500 max-w-md truncate">{a.details ? JSON.stringify(a.details) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.auditLogs.length === 0 && <EmptyState>{t.noData}</EmptyState>}
          </div>
        </Card>
      )}

      {tab === 'demo' && (
        <Card>
          <CardHeader title="Demo data" subtitle="The demo dataset is isolated from real records. Resetting affects only demo records and preserves every session." />
          <div className="p-4 space-y-3">
            <Alert tone="warning">{t.disclaimer}</Alert>
            <Button variant="danger" onClick={resetDemo} disabled={busy === 'demo'}>{busy === 'demo' ? t.loading : 'Reset demo dataset'}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
