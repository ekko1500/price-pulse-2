import { SupplierProduct } from '../types';

/**
 * Product name/search helpers.
 *
 * In Myanmar the same product is called many different names (English label name,
 * formal Burmese, colloquial Burmese, brand nicknames, transliterations). These
 * helpers flatten all of those into one searchable set so any common name finds
 * the product. This module intentionally has NO dependencies (it is imported by
 * client components) — do not import AI/DB code here.
 */

const MY_DIGITS: Record<string, string> = {
  '၀': '0', '၁': '1', '၂': '2', '၃': '3', '၄': '4',
  '၅': '5', '၆': '6', '၇': '7', '၈': '8', '၉': '9',
};

/** Normalise text for comparison: Myanmar digits -> ASCII, lower-case, collapse spaces. */
export function normalizeSearchText(input: string): string {
  return input
    .replace(/[၀-၉]/g, (d) => MY_DIGITS[d] ?? d)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a display name into useful fragments, e.g. "Cooking Oil (စားသုံးဆီ)" -> "Cooking Oil". */
function fragments(name: string): string[] {
  const parts = [name, name.split('(')[0], name.split('/')[0], name.split(',')[0]];
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * All names a product can be found by: display name, English/Burmese/colloquial
 * names, brand, aliases and keywords — plus parenthetical-stripped fragments.
 * Returned values are raw (display) strings; comparison must use normalizeSearchText.
 */
export function productNames(p: SupplierProduct): string[] {
  const raw: Array<string | undefined> = [
    p.name,
    p.nameEn,
    p.nameMy,
    p.colloquialNameMy,
    p.brand,
    ...(p.aliases ?? []),
    ...(p.searchKeywords ?? []),
  ];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    for (const frag of fragments(value)) {
      const key = normalizeSearchText(frag);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(frag);
    }
  }
  return out;
}

/** Fields consulted for a search/match, normalised. */
function searchableTerms(p: SupplierProduct): string[] {
  const raw: Array<string | undefined> = [
    p.name,
    p.nameEn,
    p.nameMy,
    p.colloquialNameMy,
    p.itemId,
    p.sku,
    p.brand,
    p.category,
    ...(p.aliases ?? []),
    ...(p.searchKeywords ?? []),
  ];
  return raw
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map(normalizeSearchText);
}

/** True when the product matches a free-text query against any of its names. */
export function matchesProduct(p: SupplierProduct, query: string): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  return productNames(p).some((term) => {
    const t = normalizeSearchText(term);
    return t.includes(q) || (t.length >= 3 && q.includes(t));
  }) || searchableTerms(p).some((t) => t.includes(q));
}

/** Filter a product list by query. An empty query returns the list unchanged. */
export function searchProducts(products: SupplierProduct[], query: string): SupplierProduct[] {
  if (!query.trim()) return products;
  return products.filter((p) => matchesProduct(p, query));
}
