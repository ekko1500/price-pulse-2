'use client';

import React from 'react';
import { useLang } from './LanguageContext';
import { Badge, Button } from './ui';
import type { PublicUser, Business } from '@/lib/types';

export function Navbar({
  user,
  business,
  isDemo,
  persistenceMode,
  unread,
  onLogout,
  onOpenNotifications,
}: {
  user: PublicUser;
  business: Business;
  isDemo: boolean;
  persistenceMode: string;
  unread: number;
  onLogout: () => void;
  onOpenNotifications: () => void;
}) {
  const { t, lang, setLang } = useLang();
  const roleLabel = user.role === 'retailer' ? t.retailer : user.role === 'wholesaler' ? t.wholesaler : t.admin;

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="font-bold text-brand-700">{t.appName}</div>
        {isDemo && <Badge tone="amber">{t.demoMode}</Badge>}
        <div className="flex-1" />
        <div className="hidden sm:block text-right leading-tight">
          <div className="text-sm font-semibold text-slate-700">{business.name}</div>
          <div className="text-xs text-slate-500">
            {roleLabel} · @{user.username}
            <span className="ml-2 text-slate-400">{persistenceMode === 'firestore' ? 'Firestore' : 'Local store'}</span>
          </div>
        </div>
        <button
          onClick={onOpenNotifications}
          className="relative rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          aria-label={t.navNotifications}
        >
          🔔
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] rounded-full px-1.5 py-0.5">
              {unread}
            </span>
          )}
        </button>
        <button
          onClick={() => setLang(lang === 'en' ? 'my' : 'en')}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          {lang === 'en' ? 'မြန်မာ' : 'English'}
        </button>
        <Button variant="secondary" size="sm" onClick={onLogout}>{t.signOut}</Button>
      </div>
    </header>
  );
}
