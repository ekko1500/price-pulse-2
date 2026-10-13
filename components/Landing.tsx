'use client';

import React from 'react';
import Link from 'next/link';
import { useLang } from './LanguageContext';
import { Card, Button } from './ui';

export function Landing() {
  const { t, lang, setLang } = useLang();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white">
        <div className="font-bold text-brand-700 text-lg">{t.appName}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang(lang === 'en' ? 'my' : 'en')}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"
            aria-label="Toggle language"
          >
            {lang === 'en' ? 'မြန်မာ' : 'English'}
          </button>
          <Link href="/login"><Button variant="secondary" size="sm">{t.signIn}</Button></Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-5 py-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">{t.appName}</h1>
        <p className="mt-2 text-slate-600 max-w-2xl">{t.tagline}</p>

        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="text-2xl">📨</div>
            <h2 className="font-semibold mt-2">Supplier price messages</h2>
            <p className="text-sm text-slate-600 mt-1">Paste a real supplier message in Burmese or English.</p>
          </Card>
          <Card className="p-5">
            <div className="text-2xl">🤖</div>
            <h2 className="font-semibold mt-2">AI-assisted extraction</h2>
            <p className="text-sm text-slate-600 mt-1">Gemini extracts the product, prices and effective date — you review before publishing.</p>
          </Card>
          <Card className="p-5">
            <div className="text-2xl">📊</div>
            <h2 className="font-semibold mt-2">Exact margin impact</h2>
            <p className="text-sm text-slate-600 mt-1">See the precise effect on gross profit and a recommended retail price.</p>
          </Card>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register"><Button>{t.register}</Button></Link>
          <Link href="/login"><Button variant="secondary">{t.signIn}</Button></Link>
          <Link href="/demo"><Button variant="ghost">{t.demoAccess}</Button></Link>
        </div>

        <p className="mt-10 text-xs text-slate-500 max-w-3xl">{t.disclaimer}</p>
      </main>
    </div>
  );
}
