'use client';

/**
 * Dependency-free PDF receipt export.
 *
 * We render the receipt onto a <canvas> (so Myanmar text, which the default
 * PDF fonts cannot encode, is rasterised using the system/web fonts) and then
 * embed that image (JPEG) into a small, valid PDF built by hand. No external
 * packages are required and it works fully offline.
 */

import type { Business, Sale } from '@/lib/types';
import { formatMMK } from '@/lib/calc/pricing';

const FONT = `'Inter', 'Noto Sans Myanmar', 'Padauk', 'Myanmar Text', 'Segoe UI', Arial, sans-serif`;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let line = '';
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
      } else if (ctx.measureText(w).width > maxWidth) {
        if (line) {
          lines.push(line);
          line = '';
        }
        let chunk = '';
        for (const ch of w) {
          if (chunk && ctx.measureText(chunk + ch).width > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        line = chunk;
      } else {
        lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Draw the receipt and return the Y position to continue the layout from. */
function drawReceipt(
  ctx: CanvasRenderingContext2D,
  W: number,
  sale: Sale,
  business: Business,
  labels: Record<string, string>
): number {
  const PAD = 18;
  const RIGHT = W - PAD;
  const MAXW = W - PAD * 2;
  const CENTER = W / 2;
  let y = PAD + 2;

  const block = (t: string, size: number, weight: string, align: 'left' | 'center' | 'right', color: string, maxWidth = MAXW) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    for (const l of wrapText(ctx, t, maxWidth)) {
      const w = ctx.measureText(l).width;
      const targetX = align === 'center' ? CENTER - w / 2 : align === 'right' ? RIGHT - w : PAD;
      ctx.fillText(l, targetX, y + size - 2);
      y += size + 2;
    }
  };

  const row = (
    leftText: string,
    rightText: string,
    size: number,
    leftWeight: string,
    rightWeight: string,
    color: string,
    reserveRight = 90
  ) => {
    ctx.font = `${leftWeight} ${size}px ${FONT}`;
    const leftLines = wrapText(ctx, leftText, Math.max(40, MAXW - reserveRight));
    leftLines.forEach((l, i) => {
      if (i > 0) {
        ctx.font = `${leftWeight} ${size}px ${FONT}`;
        ctx.fillStyle = color;
        ctx.fillText(l, PAD, y + size - 2);
      } else {
        ctx.font = `${leftWeight} ${size}px ${FONT}`;
        ctx.fillStyle = color;
        ctx.fillText(l, PAD, y + size - 2);
        if (rightText) {
          ctx.font = `${rightWeight} ${size}px ${FONT}`;
          ctx.fillStyle = color;
          ctx.fillText(rightText, RIGHT - ctx.measureText(rightText).width, y + size - 2);
        }
      }
      y += size + 2;
    });
  };

  const divider = (color = '#cbd5e1', gapBefore = 6, gapAfter = 8) => {
    y += gapBefore;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(RIGHT, y);
    ctx.stroke();
    y += gapAfter;
  };

  // ---- Header ----
  block(business.name, 16, '700', 'center', '#0f172a');
  const headerExtras: string[] = [];
  if (business.address) headerExtras.push(business.address);
  if (business.city) headerExtras.push(business.city);
  if (headerExtras.length) block(headerExtras.join(' · '), 9.5, '400', 'center', '#667085');
  if (business.phoneNumber) block(`Tel ${business.phoneNumber}`, 9.5, '400', 'center', '#667085');
  divider();

  // ---- Receipt meta ----
  const d = new Date(sale.soldAt);
  const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  block(labels.receipt, 17, '700', 'center', '#0f172a');
  block(sale.receiptNumber, 11, '600', 'center', '#1d4ed8');
  block(`${labels.channel} · ${dateStr} ${timeStr}`, 9.5, '400', 'center', '#667085');
  y += 4;

  if (sale.status === 'voided') {
    y += 2;
    const vLabel = sale.voidedAt
      ? `${labels.voided} · ${new Date(sale.voidedAt).toLocaleString('en-GB')}`
      : labels.voided;
    block(vLabel, 13, '700', 'center', '#dc2626');
    y += 2;
  }

  divider();

  // ---- Customer ----
  if (sale.customerName || sale.customerPhone) {
    row(`${labels.customer}: ${sale.customerName || '—'}`, '', 11, '600', '600', '#111827', 0);
    if (sale.customerPhone) row(`Tel ${sale.customerPhone}`, '', 10, '400', '400', '#475467', 0);
    divider();
  }

  // ---- Items ----
  row(labels.item, labels.amount, 10, '600', '600', '#475467', 0);
  ctx.fillStyle = '#e4e7ec';
  ctx.fillRect(PAD, y, MAXW, 1);
  y += 6;

  for (const it of sale.items) {
    const priceHint = it.unitCost && sale.sellerRole === 'retailer'
      ? ` @ ${formatMMK(it.unitPrice)}/${it.unit}`
      : '';
    row(`${it.quantity} × ${it.name}${priceHint}`, formatMMK(it.lineTotal), 11, '500', '700', '#111827');
    y += 3;
  }

  divider();

  // ---- Totals ----
  row(labels.subtotal, formatMMK(sale.subtotal), 11, '400', '500', '#475467');
  if (sale.discount > 0) row(labels.discount, `- ${formatMMK(sale.discount)}`, 11, '400', '500', '#dc2626');
  y += 2;
  ctx.font = `700 15px ${FONT}`;
  ctx.fillStyle = '#0f172a';
  const totalLabel = labels.total;
  const totalVal = formatMMK(sale.total);
  ctx.fillText(totalLabel, PAD, y + 12);
  ctx.fillText(totalVal, RIGHT - ctx.measureText(totalVal).width, y + 12);
  y += 26;

  row(labels.paid, formatMMK(sale.amountPaid), 11, '400', '500', '#475467');
  if (sale.changeDue > 0) row(labels.change, formatMMK(sale.changeDue), 11, '400', '600', '#047857');
  row(labels.payment, sale.paymentMethod, 11, '400', '500', '#475467');

  divider();

  // ---- Footer ----
  block(labels.thanks, 11.5, '600', 'center', '#0f172a');
  block(labels.disclaimer, 8.5, '400', 'center', '#98a2b3');
  y += 6;

  return y;
}

function renderReceiptCanvas(sale: Sale, business: Business, labels: Record<string, string>): HTMLCanvasElement {
  const W = 420;
  const source = document.createElement('canvas');
  source.width = W;
  const sourceHeight = 2400;
  source.height = sourceHeight;
  const ctx = source.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, sourceHeight);
  const bottom = drawReceipt(ctx, W, sale, business, labels) + 14;

  const crop = document.createElement('canvas');
  crop.width = W;
  crop.height = Math.max(120, Math.min(sourceHeight, Math.ceil(bottom)));
  const cctx = crop.getContext('2d');
  if (!cctx) throw new Error('Canvas is not available in this browser.');
  cctx.fillStyle = '#ffffff';
  cctx.fillRect(0, 0, crop.width, crop.height);
  cctx.drawImage(source, 0, 0);
  return crop;
}

/** Assemble a minimal single-page PDF that embeds a JPEG image. */
function buildPdfFromJpeg(jpeg: Uint8Array, imgW: number, imgH: number): Uint8Array {
  const enc = new TextEncoder();
  const bytes = (s: string) => enc.encode(s);
  const parts: Uint8Array[] = [];
  const offsets = new Array(6).fill(0);
  let pos = 0;
  const push = (b: string | Uint8Array): number => {
    const bb = typeof b === 'string' ? bytes(b) : b;
    const off = pos;
    parts.push(bb);
    pos += bb.length;
    return off;
  };

  // 80mm thermal receipt width in points (72/25.4 * 80 ≈ 226.77)
  const pageW = Math.round((72 / 25.4) * 80);
  const pageH = Math.round((pageW * imgH) / imgW);

  push('%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n');

  offsets[1] = push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  offsets[2] = push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  offsets[3] = push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`
  );

  const contentStream = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
  offsets[4] = push(`4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`);

  offsets[5] = push(
    `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
  );
  push(jpeg);
  push('\nendstream\nendobj\n');

  const xrefStart = pos;
  push('xref\n0 6\n');
  push('0000000000 65535 f \n');
  for (let i = 1; i <= 5; i += 1) {
    push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export function exportSaleReceiptPdf(sale: Sale, business: Business, lang: 'en' | 'my'): Promise<void> {
  const isMy = lang === 'my';
  const labels: Record<string, string> = {
    receipt: isMy ? 'ပြေစာ' : 'RECEIPT',
    item: isMy ? 'ကုန်ပစ္စည်း' : 'ITEM',
    amount: isMy ? 'ကျသင့်ငွေ' : 'AMOUNT',
    subtotal: isMy ? 'ကုန်ကျငွေ' : 'Subtotal',
    discount: isMy ? 'လျှော့စျေး' : 'Discount',
    total: isMy ? 'စုစုပေါင်း' : 'TOTAL',
    paid: isMy ? 'ပေးချေငွေ' : 'Paid',
    change: isMy ? 'ပြန်အမ်းငွေ' : 'Change due',
    payment: isMy ? 'ငွေပေးချေမှု' : 'Payment',
    customer: isMy ? 'ဝယ်သူ' : 'Customer',
    thanks: isMy ? 'ဝယ်ယူအားပေးမှု ကျေးဇူးတင်ပါသည်' : 'Thank you for your purchase!',
    disclaimer: isMy
      ? 'ဤပြေစာသည် အလိုအလျောက်ထုတ်ပေးသော ပြေစာဖြစ်သည်။'
      : 'This is an auto-generated receipt. Keep it for your records.',
    voided: isMy ? 'ပြန်ဖျက်ပြီး ပြေစာ' : 'VOIDED',
    channel: sale.channel === 'retail'
      ? isMy ? 'လက်လီအရောင်း' : 'Retail sale'
      : isMy ? 'လက်ကားအရောင်း' : 'Wholesale sale',
  };

  return (async () => {
    try {
      if (document.fonts?.ready) await document.fonts.ready;
    } catch {
      /* fonts API optional */
    }
    const canvas = renderReceiptCanvas(sale, business, labels);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.split(',')[1] ?? '';
    const bin = atob(base64);
    const jpeg = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) jpeg[i] = bin.charCodeAt(i);

    const pdfBytes = buildPdfFromJpeg(jpeg, canvas.width, canvas.height);
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt-${sale.receiptNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  })();
}