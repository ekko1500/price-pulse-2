'use client';

import React, { useMemo, useState } from 'react';
import { api } from './api';
import { useLang } from './LanguageContext';
import { Card, CardHeader, Button, Field, Select, Alert, EmptyState } from './ui';
import type { BootstrapData } from './types';

type Mode = 'inventory' | 'prices';

const FIELD_LABELS_INV = {
  name: 'Item name *', category: 'Category', unit: 'Unit', packageSize: 'Package size',
  currentStock: 'Stock quantity', lowStockThreshold: 'Low-stock threshold',
  expiryDate: 'Expiry date (YYYY-MM-DD)', currentSellingPrice: 'Selling price', lastSupplierCost: 'Supplier cost',
} as const;

const FIELD_LABELS_PRICE = {
  productName: 'Product name *', newPrice: 'New price *', effectiveDate: 'Effective date (YYYY-MM-DD)',
} as const;

function guess(headers: string[], field: string): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const target = norm(field);
  const exact = headers.find((h) => norm(h) === target);
  if (exact) return exact;
  const partial = headers.find((h) => norm(h).includes(target) || target.includes(norm(h)));
  return partial ?? '';
}

export function ImportPanel({ mode, data, refresh, onDone }: { mode: Mode; data: BootstrapData; refresh: () => Promise<void>; onDone: (m: string) => void }) {
  const { t } = useLang();
  const fields = mode === 'inventory' ? (Object.keys(FIELD_LABELS_INV) as (keyof typeof FIELD_LABELS_INV)[]) : (Object.keys(FIELD_LABELS_PRICE) as (keyof typeof FIELD_LABELS_PRICE)[]);
  const labels = (mode === 'inventory' ? FIELD_LABELS_INV : FIELD_LABELS_PRICE) as Record<string, string>;

  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Array<{ row: number; status: string; message?: string; name?: string }> | null>(null);

  const preview = useMemo(() => allRows.slice(0, 8), [allRows]);

  const onFile = async (file: File) => {
    setBusy(true);
    setError('');
    setResults(null);
    const fd = new FormData();
    fd.append('file', file);
    const res = await api<{ headers: string[]; rows: Record<string, unknown>[]; allRows: Record<string, unknown>[] }>(
      '/api/import/parse',
      { method: 'POST', body: fd }
    );
    setBusy(false);
    if (!res.ok || !res.data) {
      setError(res.message || 'Could not read the file.');
      return;
    }
    setHeaders(res.data.headers);
    setAllRows(res.data.allRows ?? res.data.rows);
    const auto: Record<string, string> = {};
    for (const f of fields) auto[f] = guess(res.data.headers, f);
    setMapping(auto);
  };

  const mappedRows = allRows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const col = mapping[f];
      out[f] = col ? r[col] : '';
    }
    return out;
  });

  const commit = async () => {
    if (mode === 'inventory' && !mapping.name) {
      setError('Map the item name column before importing.');
      return;
    }
    if (mode === 'prices' && !mapping.newPrice) {
      setError('Map the new price column before importing.');
      return;
    }
    setBusy(true);
    setError('');
    const endpoint = mode === 'inventory' ? '/api/inventory/import/commit' : '/api/prices/import/commit';
    const res = await api<{ results: Array<{ row: number; status: string; message?: string; name?: string }> }>(
      endpoint,
      { json: { rows: mappedRows, duplicateStrategy: 'skip' } }
    );
    setBusy(false);
    if (!res.ok || !res.data) {
      setError(res.message || 'Import failed.');
      return;
    }
    setResults(res.data.results);
    if (mode === 'inventory') {
      onDone(`${t.success}: inventory import complete.`);
    } else {
      onDone(`${t.success}: price drafts created — review them in “${t.navPriceUpdate}”.`);
    }
    setAllRows([]);
    setHeaders([]);
    await refresh();
  };

  return (
    <Card>
      <CardHeader title={mode === 'inventory' ? 'Import inventory (CSV / Excel)' : 'Import prices (CSV / Excel)'} subtitle={mode === 'prices' ? 'Each valid row becomes a draft for review — nothing is published automatically.' : 'Duplicate names are skipped, never overwritten.'} />
      <div className="p-4 space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          className="block text-sm"
        />
        {busy && <div className="text-xs text-slate-500">{t.loading}</div>}

        {headers.length > 0 && (
          <>
            <div>
              <div className="text-sm font-semibold text-slate-700 mb-2">Map columns</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {fields.map((f) => (
                  <Field key={f} label={labels[f]}>
                    <Select value={mapping[f] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value }))}>
                      <option value="">— ignore —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </Select>
                  </Field>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-700 mb-2">Preview ({preview.length} of {allRows.length})</div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>{fields.map((f) => <th key={f} className="text-left px-2 py-1">{labels[f]}</th>)}</tr>
                  </thead>
                  <tbody>
                    {mappedRows.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        {fields.map((f) => <td key={f} className="px-2 py-1">{String(r[f] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Button onClick={commit} disabled={busy}>{busy ? t.loading : 'Validate & import'}</Button>
          </>
        )}

        {results && (
          <div>
            <div className="text-sm font-semibold text-slate-700 mb-2">Row results</div>
            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {results.map((r) => (
                <div key={r.row} className="px-3 py-1.5 text-xs flex justify-between">
                  <span>Row {r.row} {r.name ? `· ${r.name}` : ''}</span>
                  <span className={r.status === 'error' ? 'text-red-600' : r.status === 'skipped' ? 'text-amber-600' : 'text-emerald-700'}>
                    {r.status}{r.message ? ` — ${r.message}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {headers.length === 0 && !results && <EmptyState>Choose a .csv or .xlsx file to begin.</EmptyState>}
      </div>
    </Card>
  );
}
