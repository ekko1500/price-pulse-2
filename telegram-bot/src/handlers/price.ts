import { Telegraf, Context } from 'telegraf';
import { PulseApi, ApiError } from '../api';
import { sessions } from '../session';
import { t } from '../i18n';
import { draftSummary } from '../format';
import { draftKeyboard } from '../keyboards';
import { logger } from '../logger';
import type { Draft, Product } from '../types';

/**
 * Handle a free-text supplier message: ask the web app to extract a price-update
 * draft (Gemini + deterministic fallback live server-side), then present it with
 * Publish / pick-product / Cancel buttons.
 */
async function handleMessage(ctx: Context, text: string): Promise<void> {
  if (!ctx.chat) return;
  const chatId = ctx.chat.id;
  const session = sessions.get(chatId);

  if (!session.cookie) {
    await ctx.reply(t(session.lang).needLogin);
    return;
  }

  const api = new PulseApi(session.cookie);
  await ctx.sendChatAction('typing').catch(() => undefined);

  let draft: Draft;
  try {
    const result = await api.extract(text);
    draft = result.draft;
  } catch (err) {
    const reason = err instanceof ApiError ? err.message : 'unknown error';
    logger.warn(`Extraction failed for chat ${chatId}: ${reason}`);
    await ctx.reply(t(session.lang).extractFailed(reason));
    return;
  }

  let catalog: Product[] = [];
  try {
    catalog = (await api.products()).products;
  } catch {
    // Product names are a nicety; the flow still works with candidate ids only.
  }

  await ctx.reply(draftSummary(session.lang, draft), {
    parse_mode: 'HTML',
    ...draftKeyboard(draft, catalog, session.lang),
  });
}

export function registerPrice(bot: Telegraf): void {
  bot.command('price', async (ctx) => {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const body = text.replace(/^\/price\b\s*/i, '').trim();
    if (!body) {
      await ctx.reply('Usage: /price <supplier message>');
      return;
    }
    await handleMessage(ctx, body);
  });

  // Catch-all for plain text. Registered last so command handlers win first.
  bot.on('text', async (ctx, next) => {
    const text = ctx.message && 'text' in ctx.message ? (ctx.message.text || '').trim() : '';
    if (!text || text.startsWith('/')) {
      return next();
    }
    await handleMessage(ctx, text);
  });
}
