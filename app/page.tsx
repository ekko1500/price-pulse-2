'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/api';
import { useLang } from '@/components/LanguageContext';
import { Landing } from '@/components/Landing';
import { Dashboard } from '@/components/Dashboard';
import type { PublicUser, Business } from '@/lib/types';

interface SessionPayload {
  authenticated: boolean;
  user?: PublicUser;
  business?: Business;
}

export default function Home() {
  const { t } = useLang();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'guest' | 'authed'>('loading');
  const [session, setSession] = useState<SessionPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api<SessionPayload>('/api/auth/session');
      if (cancelled) return;
      if (res.ok && res.data?.authenticated) {
        setSession(res.data);
        setState('authed');
      } else {
        setState('guest');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onLogout = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    setSession(null);
    setState('guest');
    router.refresh();
  };

  if (state === 'loading') {
    return <div className="min-h-screen grid place-items-center text-slate-400 text-sm">{t.loading}</div>;
  }
  if (state === 'guest') return <Landing />;
  return <Dashboard session={{ user: session!.user!, business: session!.business! }} onLogout={onLogout} />;
}
