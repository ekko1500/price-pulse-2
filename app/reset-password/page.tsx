'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/components/api';
import { useLang } from '@/components/LanguageContext';
import { Card, Button, Field, Input, Alert } from '@/components/ui';

export default function ResetPasswordPage() {
  const { t } = useLang();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await api('/api/auth/reset-password', { json: { username, token, newPassword } });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push('/login'), 1800);
    } else {
      setError(res.message || 'Reset failed.');
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-bold text-slate-900">Reset password</h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter the one-time token issued by an administrator, then choose a new password. The token expires in 30 minutes.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          {done && <Alert tone="success">Password updated. Redirecting to sign in…</Alert>}
          <Field label={t.username}>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </Field>
          <Field label="One-time reset token">
            <Input value={token} onChange={(e) => setToken(e.target.value)} required />
          </Field>
          <Field label="New password" hint="At least 8 characters with a letter and a number.">
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </Field>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t.loading : 'Reset password'}
          </Button>
        </form>
        <div className="mt-4 text-sm">
          <Link href="/login" className="text-brand-600 hover:underline">{t.signIn}</Link>
        </div>
      </Card>
    </div>
  );
}
