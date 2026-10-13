'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Language, translations, Strings } from '@/lib/i18n/translations';

interface Ctx {
  lang: Language;
  setLang: (l: Language) => void;
  t: Strings;
}

const LanguageCtx = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('pp_lang') as Language | null;
      if (saved === 'en' || saved === 'my') setLangState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = (l: Language) => {
    setLangState(l);
    try {
      window.localStorage.setItem('pp_lang', l);
    } catch {
      /* ignore */
    }
  };

  return (
    <LanguageCtx.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageCtx.Provider>
  );
}

export function useLang(): Ctx {
  const ctx = useContext(LanguageCtx);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
