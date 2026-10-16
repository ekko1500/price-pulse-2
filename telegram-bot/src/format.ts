import { t, type Lang } from './i18n';
import type { Draft } from './types';

/** Escape text for Telegram HTML parse mode. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Format an MMK amount: 5800 -> "5,800". */
export function formatMMK(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** Build the HTML summary shown for a draft. */
export function draftSummary(lang: Lang, draft: Draft): string {
  const m = t(lang);
  const esc = escapeHtml;
  const lines: string[] = [`<b>${esc(m.draftTitle)}</b>`];

  lines.push(`${esc(m.labelProduct)}: <b>${esc(draft.productName || m.unknown)}</b>`);
  if (draft.brand) lines.push(`${esc(m.labelBrand)}: ${esc(draft.brand)}`);
  if (draft.packageSize) lines.push(`${esc(m.labelSize)}: ${esc(draft.packageSize)}`);
  lines.push(`${esc(m.labelUnit)}: ${esc(draft.unit)}`);
  if (draft.previousPrice) lines.push(`${esc(m.labelOldPrice)}: ${formatMMK(draft.previousPrice)} MMK`);
  lines.push(`${esc(m.labelNewPrice)}: <b>${formatMMK(draft.newPrice)} MMK</b>`);
  if (draft.effectiveDate) lines.push(`${esc(m.labelEffective)}: ${esc(draft.effectiveDate)}`);
  lines.push(`${esc(m.labelConfidence)}: ${Math.round(draft.confidence * 100)}%`);

  if (draft.warnings.length > 0) {
    lines.push('');
    for (const w of draft.warnings) lines.push(`⚠️ ${esc(w)}`);
  }
  if (draft.missingFields.length > 0) {
    lines.push('');
    lines.push(`❗ ${esc(m.labelMissing)}: ${draft.missingFields.map(esc).join(', ')}`);
  }
  return lines.join('\n');
}
