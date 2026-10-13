'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useLang } from './LanguageContext';
import { Navbar } from './Navbar';
import { NotificationCenter } from './NotificationCenter';
import { Button, Alert } from './ui';
import type { BootstrapData } from './types';
import type { PublicUser, Business } from '@/lib/types';
import { WholesalerDashboard } from './wholesaler/WholesalerDashboard';
import { RetailerDashboard } from './retailer/RetailerDashboard';
import { AdminDashboard } from './admin/AdminDashboard';

interface SessionPayload {
  user: PublicUser;
  business: Business;
}

export function Dashboard({ session, onLogout }: { session: SessionPayload; onLogout: () => void }) {
  const { t } = useLang();
  const [data, setData] = useState<BootstrapData | null>(null);
  const [error, setError] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  const refresh = useCallback(async () => {
    const res = await api<BootstrapData>('/api/bootstrap');
    if (res.ok && res.data) {
      setData(res.data);
      setError('');
    } else {
      setError(res.message || 'Unable to load your data.');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Alert tone="error">{error}</Alert>
        <div className="mt-4"><Button onClick={onLogout}>{t.signOut}</Button></div>
      </div>
    );
  }

  if (!data) {
    return <div className="min-h-screen grid place-items-center text-slate-400 text-sm">{t.loading}</div>;
  }

  const unread = data.notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        user={data.user}
        business={data.business}
        isDemo={data.isDemo}
        persistenceMode={data.persistenceMode}
        unread={unread}
        onLogout={onLogout}
        onOpenNotifications={() => setShowNotifications(true)}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {data.isDemo && (
          <div className="mb-4"><Alert tone="warning">{t.demoMode}: {t.disclaimer}</Alert></div>
        )}
        {data.user.role === 'wholesaler' && <WholesalerDashboard data={data} refresh={refresh} />}
        {data.user.role === 'retailer' && <RetailerDashboard data={data} refresh={refresh} />}
        {data.user.role === 'admin' && <AdminDashboard data={data} refresh={refresh} />}
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <p className="font-semibold text-slate-700">{t.appName} · Google AI Builder Cup 2026</p>
        <p className="mt-1">{t.disclaimer}</p>
      </footer>

      {showNotifications && (
        <NotificationCenter
          notifications={data.notifications}
          onClose={() => setShowNotifications(false)}
          refresh={refresh}
        />
      )}
    </div>
  );
}
