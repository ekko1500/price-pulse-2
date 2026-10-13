'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/components/api';
import { useLang } from '@/components/LanguageContext';
import { Card, Button, Alert } from '@/components/ui';

const PERSONAS: Array<{ key: string; label: string; desc: string }> = [
  { key: 'wholesaler', label: 'Wholesaler — Aung Wholesale', desc: 'Publish price updates, manage catalog & orders.' },
  { key: 'wholesaler2', label: 'Wholesaler — Mandalay Depot', desc: 'Second supplier for comparison.' },
  { key: 'retailer', label: 'Retailer — Shwe Family Grocery', desc: 'See price alerts, margins, inventory & orders.' },
  { key: 'retailer2', label: 'Retailer — Kyaw Mini Mart', desc: 'Second retailer with a pending request.' },
  { key: 'admin', label: 'Administrator', desc: 'Accounts, audit log, demo controls.' },
];

export default function DemoPage() {
  const { t } = useLang();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const enter = async (persona: string) => {
    setBusy(persona);
    setError('');
    const res = await api('/api/demo/login', { json: { persona } });
    setBusy('');
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError(res.message || 'Demo account unavailable. Try resetting demo data from the admin account.');
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <Card className="w-full max-w-lg p-6">
        <h1 className="text-xl font-bold text-slate-900">{t.demoAccess}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter a pre-seeded, clearly-labelled demo role. No password required. All records are fictional.
        </p>
        {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}
        <div className="mt-5 space-y-3">
          {PERSONAS.map((p) => (
            <button
              key={p.key}
              onClick={() => enter(p.key)}
              disabled={!!busy}
              className="w-full text-left rounded-lg border border-slate-200 hover:border-brand-400 hover:bg-brand-50 px-4 py-3 transition disabled:opacity-50"
            >
              <div className="font-semibold text-slate-800">{p.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{p.desc}</div>
              {busy === p.key && <div className="text-xs text-brand-600 mt-1">{t.loading}</div>}
            </button>
          ))}
        </div>
        <div className="mt-5 text-sm">
          <Link href="/login" className="text-brand-600 hover:underline">{t.signIn}</Link>
        </div>
      </Card>
    </div>
  );
}
