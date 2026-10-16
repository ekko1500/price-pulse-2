import { Markup } from 'telegraf';
import { t, type Lang } from './i18n';
import type { Draft, Product } from './types';

type Row = { text: string; callback_data: string }[];

/**
 * Inline keyboard for a freshly extracted draft.
 * - If a single product is resolved and the price is valid: offer Publish.
 * - Otherwise list candidate/catalog products to pick from.
 */
export function draftKeyboard(draft: Draft, catalog: Product[], lang: Lang) {
  const m = t(lang);
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const rows: Row[] = [];

  const publishable = Boolean(draft.productId) && draft.newPrice > 0;
  if (publishable) rows.push([{ text: m.publish, callback_data: `publish:${draft.id}` }]);

  if (!publishable) {
    const candidates = draft.candidateProductIds.filter((id) => byId.has(id));
    const options = candidates.length > 0 ? candidates : catalog.map((p) => p.id);
    for (const id of options.slice(0, 8)) {
      rows.push([{ text: `🛒 ${byId.get(id)!.name}`, callback_data: `pick:${draft.id}:${id}` }]);
    }
  } else if (draft.candidateProductIds.length > 1) {
    rows.push([{ text: m.changeProduct, callback_data: `choose:${draft.id}` }]);
  }

  rows.push([{ text: m.cancel, callback_data: `cancel:${draft.id}` }]);
  return Markup.inlineKeyboard(rows);
}

/** Full (paged-to-10) catalog picker, used by the "Change product" button. */
export function catalogKeyboard(draft: Draft, catalog: Product[], lang: Lang) {
  const m = t(lang);
  const rows: Row[] = catalog
    .slice(0, 10)
    .map((p) => [{ text: `🛒 ${p.name}`, callback_data: `pick:${draft.id}:${p.id}` }]);
  rows.push([{ text: m.cancel, callback_data: `cancel:${draft.id}` }]);
  return Markup.inlineKeyboard(rows);
}
