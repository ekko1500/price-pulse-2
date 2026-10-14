/**
 * Supported Gemini models for supplier-message extraction.
 *
 * The client may request a model from this allow-list; the server never passes
 * an arbitrary string to the SDK. `GEMINI_MODEL` (env) overrides the default.
 */

export interface GeminiModelOption {
  id: string;
  label: string;
  tier: 'free' | 'paid';
}

export const GEMINI_MODELS: GeminiModelOption[] = [
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite — fastest, free tier', tier: 'free' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — balanced, free tier', tier: 'free' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', tier: 'free' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', tier: 'free' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro — most capable, paid', tier: 'paid' },
];

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';

const MODEL_ID_RE = /^[a-z0-9][a-z0-9.\-]{1,63}$/i;

export function isAllowedModel(id: unknown): id is string {
  return typeof id === 'string' && GEMINI_MODELS.some((m) => m.id === id);
}

/**
 * Resolve the model to use for a request:
 *   1. a model explicitly requested by the client, if it is in the allow-list;
 *   2. the server-configured `GEMINI_MODEL` (any well-formed id);
 *   3. the built-in default.
 */
export function resolveModel(requested?: unknown): string {
  if (isAllowedModel(requested)) return requested;
  const env = process.env.GEMINI_MODEL;
  if (typeof env === 'string' && MODEL_ID_RE.test(env.trim())) return env.trim();
  return DEFAULT_GEMINI_MODEL;
}

/**
 * Model used for image moderation / tagging. All models in the allow-list accept
 * image input; `GEMINI_VISION_MODEL` overrides the default.
 */
export function resolveVisionModel(): string {
  const env = process.env.GEMINI_VISION_MODEL;
  if (typeof env === 'string' && MODEL_ID_RE.test(env.trim())) return env.trim();
  return DEFAULT_GEMINI_MODEL;
}
