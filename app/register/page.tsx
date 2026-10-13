'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/components/api';
import { useLang } from '@/components/LanguageContext';
import { Card, Button, Field, Input, Select, Alert } from '@/components/ui';

export default function RegisterPage() {
  const { t } = useLang();
  const router = useRouter();
  const [form, setForm] = useState({
    username: '',
    password: '',
    phoneNumber: '',
    businessName: '',
    role: 'retailer',
  });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setFields({});
    const res = await api('/api/auth/register', { json: form });
    setLoading(false);
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError(res.message || 'Unable to register.');
      if (res.fields) setFields(res.fields);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-bold text-slate-900">{t.registerTitle}</h1>
        <form onSubmit={submit} className="mt-5 space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label={t.businessName} error={fields.businessName}>
            <Input value={form.businessName} onChange={(e) => set('businessName', e.target.value)} required />
          </Field>
          <Field label={t.username} hint="3–32 characters: letters, numbers, _ or ." error={fields.username}>
            <Input value={form.username} onChange={(e) => set('username', e.target.value)} autoComplete="username" required />
          </Field>
          <Field label={t.password} hint="At least 8 characters with a letter and a number." error={fields.password}>
            <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" required />
          </Field>
          <Field label={t.phone} hint="Myanmar format, e.g. 09xxxxxxxxx" error={fields.phoneNumber}>
            <Input value={form.phoneNumber} onChange={(e) => set('phoneNumber', e.target.value)} required />
          </Field>
          <Field label={t.role} error={fields.role}>
            <Select value={form.role} onChange={(e) => set('role', e.target.value)}>
              <option value="retailer">{t.retailer}</option>
              <option value="wholesaler">{t.wholesaler}</option>
            </Select>
          </Field>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t.loading : t.register}
          </Button>
        </form>
        <div className="mt-4 text-sm">
          <Link href="/login" className="text-brand-600 hover:underline">{t.signIn}</Link>
        </div>
      </Card>
    </div>
  );
}
