'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Minus, Trash2, Search, ShoppingCart, FileDown, X } from 'lucide-react';
import { api } from '../api';
import { useLang } from '../LanguageContext';
import { Card, CardHeader, Button, Field, Input, Select, Alert, EmptyState } from '../ui';
import type { BootstrapData } from '../types';
import type { SalePaymentMethod, Sale, SaleItem } from '@/lib/types';
import { formatMMK } from '@/lib/calc/pricing';
import { normalizeItemKey } from '@/lib/thumbnails/constants';
import { exportSaleReceiptPdf } from './receiptPdf';

interface CartLine {
  productId: string;
  name: string;
  unit: string;
  price: number;
  stockLimit: number | undefined;
  qty: number;
}

const PAYMENT_OPTIONS: Array<{ value: SalePaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'kbzpay', label: 'KBZ Pay' },
  { value: 'wavepay', label: 'Wave Pay' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'credit', label: 'Credit' },
];

export function PosTerminal({ data, refresh }: { data: BootstrapData; refresh: () => Promise<void> }) {
  const { t, lang } = useLang();
  const isRetailer = data.user.role === 'retailer';

  const catalog = useMemo(() => {
    const thumbFor = (name: string) =>
      data.thumbnails.find((th) => th.itemKey === normalizeItemKey(name) && th.status === 'active')?.url;
    if (isRetailer) {
      return data.inventory.map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit || 'piece',
        price: i.currentSellingPrice,
        stockLimit: i.currentStock,
        imageUrl: i.activeThumbnailUrl || thumbFor(i.name),
      }));
    }
    return data.products.map((p) => ({
      id: p.id,
      name: `${p.name}${p.packageSize ? ' ' + p.packageSize : ''}`,
      unit: p.unit,
      price: p.currentPrice,
      stockLimit: p.stockQuantity,
      imageUrl: p.activeThumbnailUrl || thumbFor(p.name),
    }));
  }, [data.inventory, data.products, data.thumbnails, isRetailer]);

  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('cash');
  const [discount, setDiscount] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [exporting, setExporting] = useState(false);

  const filtered = catalog.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q);
  });

  const cartLines = Object.values(cart);
  const subtotal = cartLines.reduce((s, c) => s + c.price * c.qty, 0);
  const discountNum = Math.max(0, Math.round(Number(discount) || 0));
  const clampedDiscount = Math.min(discountNum, subtotal);
  const total = subtotal - clampedDiscount;
  const paidNum = amountPaid.trim() === ''
    ? paymentMethod === 'credit' ? 0 : total
    : Math.max(0, Math.round(Number(amountPaid) || 0));
  const change = paymentMethod === 'cash' && paidNum > total ? paidNum - total : 0;

  const capacity = (line: CartLine) => (line.stockLimit === undefined ? Infinity : line.stockLimit);

  const addToCart = (c: (typeof catalog)[number]) => {
    setCart((prev) => {
      const existing = prev[c.id];
      if (existing) {
        if (existing.qty + 1 > capacity(existing)) return prev;
        return { ...prev, [c.id]: { ...existing, qty: existing.qty + 1 } };
      }
      return { ...prev, [c.id]: { productId: c.id, name: c.name, unit: c.unit, price: c.price, stockLimit: c.stockLimit, qty: 1 } };
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) => {
      const line = prev[id];
      if (!line) return prev;
      const next = line.qty + delta;
      if (next <= 0) {
        const rest = { ...prev };
        delete rest[id];
        return rest;
      }
      if (next > capacity(line)) return prev;
      return { ...prev, [id]: { ...line, qty: next } };
    });
  };

  const removeLine = (id: string) => {
    setCart((prev) => {
      const rest = { ...prev };
      delete rest[id];
      return rest;
    });
  };

  const submit = async () => {
    if (cartLines.length === 0) {
      setError('Add at least one item before checking out.');
      return;
    }
    if (!paymentMethod) {
      setError('Choose a payment method.');
      return;
    }
    setBusy(true);
    setError('');
    const res = await api<{ sale: Sale }>('/api/sales', {
      json: {
        items: cartLines.map((l) => ({ productId: l.productId, quantity: l.qty })),
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        discount: clampedDiscount,
        paymentMethod,
        amountPaid: paidNum,
        notes: notes.trim() || undefined,
      },
    });
    setBusy(false);
    if (res.ok && res.data) {
      setReceipt(res.data.sale);
      setCart({});
      setCustomerName('');
      setCustomerPhone('');
      setDiscount('');
      setAmountPaid('');
      setNotes('');
      await refresh();
    } else {
      setError(res.message || 'Could not complete the sale.');
    }
  };

  const exportPdf = async (sale: Sale) => {
    setExporting(true);
    try {
      await exportSaleReceiptPdf(sale, data.business, lang);
    } catch (e) {
      setError((e as Error).message || 'Could not export the PDF.');
    }
    setExporting(false);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
      {error && <Alert tone="error">{error}</Alert>}

      {/* Catalog */}
      <Card>
        <CardHeader title={isRetailer ? t.navInventory : t.navCatalog} subtitle="Tap a product to add it to the cart" />
        <div className="p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input className="pl-9" placeholder={`${t.search}…`} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {filtered.map((c) => {
              const out = c.stockLimit !== undefined && c.stockLimit <= 0;
              return (
                <button
                  key={c.id}
                  onClick={() => addToCart(c)}
                  disabled={out}
                  className="text-left rounded-lg border border-slate-200 p-3 hover:border-brand-500 hover:shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded object-cover border border-slate-200" />
                    ) : (
                      <div className="h-11 w-11 shrink-0 rounded bg-slate-100 grid place-items-center text-slate-300 text-xs">IMG</div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 myanmar line-clamp-2">{c.name}</div>
                      <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                        <span className="tabular-nums text-brand-700 font-semibold">{formatMMK(c.price)}</span>
                        {c.stockLimit !== undefined && (
                          <span className={out ? 'text-red-600' : 'text-slate-400'}>
                            {t.stock}: {c.stockLimit}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && <EmptyState>{t.noData}</EmptyState>}
        </div>
      </Card>

      {/* Cart + checkout */}
      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><ShoppingCart size={16} /> {t.cart}</span>}
          action={
            cartLines.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setCart({})}>{t.clearCart}</Button>
            ) : undefined
          }
        />
        <div className="p-4 space-y-4">
          {cartLines.length === 0 && <EmptyState>Cart is empty.</EmptyState>}

          <div className="space-y-2">
            {cartLines.map((l) => (
              <div key={l.productId} className="flex items-center gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="truncate myanmar font-medium text-slate-800">{l.name}</div>
                  <div className="text-xs text-slate-500 tabular-nums">{formatMMK(l.price)}/{l.unit}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="rounded border border-slate-300 p-1 hover:bg-slate-50" onClick={() => changeQty(l.productId, -1)}>
                    <Minus size={12} />
                  </button>
                  <span className="w-8 text-center tabular-nums">{l.qty}</span>
                  <button className="rounded border border-slate-300 p-1 hover:bg-slate-50" onClick={() => changeQty(l.productId, 1)}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="w-20 text-right tabular-nums font-semibold">{formatMMK(l.price * l.qty)}</div>
                <button className="text-red-500 hover:text-red-700" onClick={() => removeLine(l.productId)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-3 grid sm:grid-cols-2 gap-3">
            <Field label={t.customerName}><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></Field>
            <Field label={t.customerPhone}><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></Field>
            <Field label={t.paymentMethod}>
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as SalePaymentMethod)}>
                {PAYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label={t.discount}>
              <Input inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
            </Field>
            <Field label={t.amountPaid} hint={paymentMethod !== 'cash' ? 'Auto-settled for non-cash payments.' : undefined}>
              <Input
                inputMode="numeric"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder={String(total)}
                disabled={paymentMethod === 'credit'}
              />
            </Field>
            <Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-slate-500"><span>{t.subtotal}</span><span className="tabular-nums">{formatMMK(subtotal)}</span></div>
            {clampedDiscount > 0 && (
              <div className="flex justify-between text-red-600"><span>{t.discount}</span><span className="tabular-nums">- {formatMMK(clampedDiscount)}</span></div>
            )}
            <div className="flex justify-between font-semibold text-base text-slate-800"><span>{t.total}</span><span className="tabular-nums">{formatMMK(total)}</span></div>
            {paymentMethod === 'cash' && change > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium"><span>{t.changeDue}</span><span className="tabular-nums">{formatMMK(change)}</span></div>
            )}
          </div>

          <Button className="w-full" onClick={submit} disabled={busy || cartLines.length === 0}>
            {busy ? t.loading : `${t.completeSale} · ${formatMMK(total)}`}
          </Button>
        </div>
      </Card>

      {/* Receipt modal */}
      {receipt && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-black/40 p-4 grid place-items-center" onClick={() => setReceipt(null)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">{t.saleCompleted}</h3>
                  <p className="text-xs text-slate-500">{receipt.receiptNumber} · {new Date(receipt.soldAt).toLocaleString()}</p>
                </div>
                <button className="text-slate-400 hover:text-slate-600" onClick={() => setReceipt(null)}><X size={18} /></button>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-700 mb-1">{data.business.name}</div>
                <div className="border border-dashed border-slate-300 rounded-lg p-3 font-mono text-xs text-slate-700 space-y-1">
                  {receipt.items.map((it: SaleItem, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="myanmar">{it.quantity} × {it.name}</span>
                      <span className="tabular-nums whitespace-nowrap">{formatMMK(it.lineTotal)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 mt-2 pt-1 flex justify-between">
                    <span>{t.total}</span><span className="tabular-nums font-bold">{formatMMK(receipt.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.payment} ({receipt.paymentMethod})</span><span className="tabular-nums">{formatMMK(receipt.amountPaid)}</span>
                  </div>
                  {receipt.changeDue > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>{t.changeDue}</span><span className="tabular-nums">{formatMMK(receipt.changeDue)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <Button disabled={exporting} onClick={() => exportPdf(receipt)}>
                  {exporting ? t.loading : <><FileDown size={15} /> {t.exportPdf}</>}
                </Button>
                <Button variant="secondary" onClick={() => setReceipt(null)}>{t.newSale}</Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}