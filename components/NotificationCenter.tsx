'use client';

import React from 'react';
import { api } from './api';
import { useLang } from './LanguageContext';
import { Card, Button, EmptyState, Badge } from './ui';
import type { InAppNotification } from '@/lib/types';

export function NotificationCenter({
  notifications,
  onClose,
  refresh,
}: {
  notifications: InAppNotification[];
  onClose: () => void;
  refresh: () => Promise<void>;
}) {
  const { t } = useLang();

  const markAll = async () => {
    await api('/api/notifications', { method: 'PATCH', json: {} });
    await refresh();
  };
  const markOne = async (id: string) => {
    await api('/api/notifications', { method: 'PATCH', json: { id } });
    await refresh();
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-slate-50 overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t.navNotifications}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800">{t.navNotifications}</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={markAll}>{t.confirm === 'Confirm' ? 'Mark all read' : 'အားလုံးဖတ်ပြီး'}</Button>
            <Button size="sm" variant="ghost" onClick={onClose}>{t.close}</Button>
          </div>
        </div>
        {notifications.length === 0 && <EmptyState>{t.noData}</EmptyState>}
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className="p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-slate-800">{n.title}</span>
                    {!n.read && <Badge tone="blue">{t.unread}</Badge>}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{n.body}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                {!n.read && (
                  <button className="text-xs text-brand-600 hover:underline" onClick={() => markOne(n.id)}>
                    {t.confirm ? 'Read' : 'ဖတ်ပြီး'}
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
