import { Telegraf, Context } from 'telegraf';
import { PulseApi, ApiError } from '../api';
import { sessions } from '../session';
import { t } from '../i18n';
import { draftSummary, formatMMK } from '../format';
import { catalogKeyboard, draftKeyboard } from '../keyboards';
import { logger } from '../logger';
import type { Product } from '../types';

/** Inline-button handler: publish a draft, pick a product, or cancel. */
async function handleCallback(ctx: Context): Promise<void> {
  const cq = ctx.callbackQuery;
  const data = cq && 'data' in cq ? cq.data : undefined;
  const chatId = ctx.chat?.id;

  if (!data || chatId === undefined) {
    await ctx.answerCbQuery().catch(() => undefined);
    return;
  }

  const [action, draftId, productId] = data.split(':');
  const session = sessions.get(chatId);
  if (!session.cookie) {
    await ctx.answerCbQuery(t(session.lang).needLogin, { show_alert: true }).catch(() => undefined);
    return;
  }

  const api = new PulseApi(session.cookie);

  try {
    if (action === 'cancel' && draftId) {
      await api.rejectDraft(draftId).catch(() => undefined);
      await ctx.answerCbQuery(t(session.lang).cancelledBtn).catch(() => undefined);
      await ctx.editMessageText(t(session.lang).cancelled).catch(() => undefined);
      return;
    }

    if (action === 'publish' && draftId) {
      await ctx.answerCbQuery().catch(() => undefined);
      const result = await api.confirmDraft(draftId);
      const name = `${result.product.name}${result.product.packageSize ? ' ' + result.product.packageSize : ''}`;
      await ctx
        .editMessageText(
          t(session.lang).published(
            name,
            formatMMK(result.history.oldPrice),
            formatMMK(result.history.newPrice),
            result.notifiedBusinessIds.length
          )
        )
        .catch(() => undefined);
      return;
    }

    if (action === 'pick' && draftId && productId) {
      const { draft } = await api.patchDraft(draftId, { productId });
      const catalog = await api.products().then((r) => r.products).catch(() => [] as Product[]);
      await ctx.answerCbQuery().catch(() => undefined);
      await ctx
        .editMessageText(draftSummary(session.lang, draft), {
          parse_mode: 'HTML',
          ...draftKeyboard(draft, catalog, session.lang),
        })
        .catch(() => undefined);
      return;
    }

    if (action === 'choose' && draftId) {
      const { drafts, products } = await api.bootstrap();
      const draft = drafts.find((d) => d.id === draftId);
      if (!draft) {
        await ctx.answerCbQuery(t(session.lang).cancelledBtn, { show_alert: true }).catch(() => undefined);
        return;
      }
      await ctx.answerCbQuery().catch(() => undefined);
      await ctx
        .editMessageText(t(session.lang).chooseProductTitle, { ...catalogKeyboard(draft, products, session.lang) })
        .catch(() => undefined);
      return;
    }

    await ctx.answerCbQuery().catch(() => undefined);
  } catch (err) {
    const reason = err instanceof ApiError ? err.message : t(session.lang).error;
    logger.warn(`Callback "${action}" failed for chat ${chatId}: ${reason}`);
    await ctx.answerCbQuery(reason, { show_alert: true }).catch(() => undefined);
  }
}

export function registerCallbacks(bot: Telegraf): void {
  bot.on('callback_query', handleCallback);
}
