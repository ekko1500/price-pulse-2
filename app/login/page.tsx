'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/components/api';
import { useLang } from '@/components/LanguageContext';
import { Card, Button, Field, Input, Alert } from '@/components/ui';

export default function LoginPage() {
  const { t } = useLang();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await api('/api/auth/login', { json: { username, password } });
    setLoading(false);
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError(res.message || 'Unable to sign in.');
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-bold text-slate-900">{t.loginTitle}</h1>
        <form onSubmit={submit} className="mt-5 space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label={t.username}>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </Field>
          <Field label={t.password}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t.loading : t.signIn}
          </Button>
        </form>
        <div className="mt-4 flex items-center justify-between text-sm">
          <Link href="/register" className="text-brand-600 hover:underline">{t.register}</Link>
          <Link href="/demo" className="text-slate-500 hover:underline">{t.demoAccess}</Link>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Forgot your password? Ask an administrator to issue a one-time reset token, then use{' '}
          <Link href="/reset-password" className="text-brand-600 hover:underline">reset password</Link>.
        </p>
      </Card>
    </div>
  );
}
