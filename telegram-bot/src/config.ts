import 'dotenv/config';
import type { Lang } from './i18n';

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name} (copy .env.example to .env)`);
  }
  return value.trim();
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  /** Required. Resolved lazily so a missing token fails inside main(), not at import. */
  get botToken(): string {
    return required('TELEGRAM_BOT_TOKEN');
  },
  /** Base URL of the PricePulse web app, without a trailing slash. */
  apiUrl: (process.env.PRICEPULSE_API_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  defaultLang: (process.env.DEFAULT_LANG === 'my' ? 'my' : 'en') as Lang,
  requestTimeoutMs: positiveInt('REQUEST_TIMEOUT_MS', 20000),
};
