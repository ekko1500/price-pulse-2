import { describe, it, expect } from 'vitest';
import { validateImageData, cleanStringList } from '@/lib/validation';

const jpeg = 'data:image/jpeg;base64,AAAAAA==';

describe('validateImageData', () => {
  it('accepts a valid, small image data URL', () => {
    expect(validateImageData(jpeg)).toBe(jpeg);
  });

  it('treats an absent image as empty (not an error)', () => {
    expect(validateImageData(undefined)).toBe('');
    expect(validateImageData(null)).toBe('');
    expect(validateImageData('')).toBe('');
  });

  it('rejects non-image and malformed data URLs', () => {
    expect(validateImageData('not-a-data-url')).toBeNull();
    expect(validateImageData('data:text/plain;base64,AAAA')).toBeNull();
    expect(validateImageData('data:image/png;base64,not base64!!')).toBeNull();
    expect(validateImageData(123)).toBeNull();
  });

  it('rejects images over the byte limit but allows the boundary', () => {
    expect(validateImageData(jpeg, 4)).toBe(jpeg);
    expect(validateImageData(jpeg, 3)).toBeNull();
  });
});

describe('cleanStringList', () => {
  it('splits comma strings, trims and removes case-insensitive duplicates', () => {
    expect(cleanStringList('a, b , A ,, c')).toEqual(['a', 'b', 'c']);
  });

  it('accepts arrays and caps the number of items', () => {
    expect(cleanStringList(['x', 'y'])).toEqual(['x', 'y']);
    expect(cleanStringList(Array.from({ length: 50 }, (_, i) => `t${i}`), 3)).toEqual(['t0', 't1', 't2']);
  });

  it('returns an empty list for non-list input', () => {
    expect(cleanStringList(undefined)).toEqual([]);
    expect(cleanStringList(123)).toEqual([]);
  });
});
