import { describe, it, expect } from 'vitest';
import { normalizeSearchText, productNames, matchesProduct, searchProducts } from '@/lib/services/productSearch';
import { SupplierProduct } from '@/lib/types';

const battery: SupplierProduct = {
  id: 'p1',
  wholesalerId: 'w1',
  name: '777 Heavy Duty AAA Battery 1.5V (4 Pack)',
  nameEn: '777 Heavy Duty AAA Battery 1.5V (4 Pack)',
  nameMy: '၇၇၇ AAA ဓာတ်ခဲ (၄ လုံးပါ)',
  colloquialNameMy: '၇၇၇ ရီမုတ်ဓာတ်ခဲ',
  brand: '777',
  category: 'Batteries',
  unit: 'pack',
  sku: '6921234567890',
  searchKeywords: [
    'ရီမုတ်ဓာတ်ခဲ', 'remote battery', '777 battery', 'AAA battery',
    'သုံးလုံးဓာတ်ခဲ', 'ဓာတ်ခဲအသေး', '1.5V battery', 'R03',
  ],
  aliases: ['၇၇၇ သုံးလုံးဓာတ်ခဲ', '777 Remote Control Battery'],
  currentPrice: 1500,
  isActive: true,
  lastUpdated: '2026-01-01T00:00:00Z',
  isDemo: false,
};

describe('product search', () => {
  it('normalises Myanmar digits to ASCII', () => {
    expect(normalizeSearchText('၇၇၇')).toBe('777');
  });

  it('collects every name, alias and keyword without duplicates', () => {
    const names = productNames(battery).map(normalizeSearchText);
    expect(names).toContain('ရီမုတ်ဓာတ်ခဲ');
    expect(names).toContain('remote battery');
    expect(names.filter((n) => n === '777 remote control battery').length).toBe(1);
  });

  it('finds a product by its colloquial Burmese name', () => {
    expect(matchesProduct(battery, 'ရီမုတ်ဓာတ်ခဲ')).toBe(true);
  });

  it('finds a product by an English alias', () => {
    expect(matchesProduct(battery, 'remote control battery')).toBe(true);
  });

  it('finds a product by barcode/SKU digits', () => {
    expect(matchesProduct(battery, '692123')).toBe(true);
  });

  it('does not match an unrelated query', () => {
    expect(matchesProduct(battery, 'cooking oil')).toBe(false);
  });

  it('returns the full list for an empty query and filters otherwise', () => {
    expect(searchProducts([battery], '').length).toBe(1);
    expect(searchProducts([battery], 'ဓာတ်ခဲ').length).toBe(1);
    expect(searchProducts([battery], 'noodles').length).toBe(0);
  });
});
