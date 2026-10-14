import { describe, it, expect } from 'vitest';
import { GEMINI_MODELS, DEFAULT_GEMINI_MODEL, isAllowedModel, resolveModel } from '@/lib/ai/models';

describe('Gemini model allow-list', () => {
  it('contains the default model', () => {
    expect(GEMINI_MODELS.some((m) => m.id === DEFAULT_GEMINI_MODEL)).toBe(true);
  });

  it('accepts only known ids', () => {
    expect(isAllowedModel('gemini-2.5-flash')).toBe(true);
    expect(isAllowedModel('gemini-2.5-pro')).toBe(true);
    expect(isAllowedModel('gemini-1.5-flash')).toBe(false);
    expect(isAllowedModel('javascript:alert(1)')).toBe(false);
    expect(isAllowedModel(42)).toBe(false);
  });

  it('prefers a requested allow-listed model', () => {
    expect(resolveModel('gemini-2.5-pro')).toBe('gemini-2.5-pro');
  });

  it('ignores an unknown requested model and falls back to the default', () => {
    const prev = process.env.GEMINI_MODEL;
    delete process.env.GEMINI_MODEL;
    expect(resolveModel('rm -rf /')).toBe(DEFAULT_GEMINI_MODEL);
    expect(resolveModel(undefined)).toBe(DEFAULT_GEMINI_MODEL);
    if (prev !== undefined) process.env.GEMINI_MODEL = prev;
  });

  it('honours a well-formed server env override', () => {
    const prev = process.env.GEMINI_MODEL;
    process.env.GEMINI_MODEL = 'gemini-custom-1';
    expect(resolveModel()).toBe('gemini-custom-1');
    // an allow-listed request still wins over env
    expect(resolveModel('gemini-2.5-flash')).toBe('gemini-2.5-flash');
    if (prev === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = prev;
  });
});
