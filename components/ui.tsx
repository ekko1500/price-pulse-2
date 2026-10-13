'use client';

import React from 'react';
import clsx from 'clsx';

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-white rounded-xl border border-slate-200 shadow-sm', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100">
      <div>
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
};

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2';
  const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };
  return <button className={clsx(base, sizes[size], variants[variant], className)} {...props} />;
}

export function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-800',
    red: 'bg-red-100 text-red-800',
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-blue-100 text-blue-800',
  };
  return <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>;
}

export function Field({ label, hint, error, children }: { label: React.ReactNode; hint?: React.ReactNode; error?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
      {error && <span className="block text-xs text-red-600 mt-1">{error}</span>}
    </label>
  );
}

const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-brand-500 focus:outline-none';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputCls, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(inputCls, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx(inputCls, props.className)} />;
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'success' | 'error' | 'warning'; children: React.ReactNode }) {
  const tones = {
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
  };
  return <div className={clsx('rounded-lg border px-3 py-2 text-sm', tones[tone])}>{children}</div>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="text-center text-sm text-slate-400 py-8">{children}</div>;
}

export function Stat({ label, value, tone }: { label: React.ReactNode; value: React.ReactNode; tone?: 'good' | 'bad' | 'muted' }) {
  const color = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-slate-800';
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={clsx('text-lg font-semibold tabular-nums', color)}>{value}</div>
    </div>
  );
}
