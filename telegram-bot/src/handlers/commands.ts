import { Telegraf, Context } from 'telegraf';
import { PulseApi, ApiError } from '../api';
import { sessions } from '../session';
import { t } from '../i18n';
import { escapeHtml, formatMMK } from '../format';
import { logger } from '../logger';

/** Read the raw text of the current message, or ''. */
export function messageText(ctx: Context): string {
  const msg = ctx.message;
  return msg && 'text' in msg && typeof msg.text === 'string' ? msg.text : '';
}

function commandArgs(ctx: Context): string[] {
  return messageText(ctx).trim().split(/\s+/).slice(1);
}

export function registerCommands(bot: Telegraf): void {
  bot.start(async (ctx) => {
    const s = sessions.get(ctx.chat.id);
    await ctx.reply(t(s.lang).start, { parse_mode: 'HTML' });
  });

  bot.help(async (ctx) => {
    const s = sessions.get(ctx.chat.id);
    await ctx.reply(t(s.lang).help);
  });

  bot.command('lang', async (ctx) => {
    const s = sessions.get(ctx.chat.id);
    const [code] = commandArgs(ctx);
    if (code === 'en' || code === 'my') {
      s.lang = code;
      sessions.save(ctx.chat.id, s);
      await ctx.reply(t(code).langSet);
    } else {
      await ctx.reply(t(s.lang).langUsage);
    }
  });

  bot.command('login', async (ctx) => {
    const s = sessions.get(ctx.chat.id);
    const [username, password] = commandArgs(ctx);
    // Best-effort: remove the message so the password is not left lying in chat.
    await ctx.deleteMessage().catch(() => undefined);

    if (!username || !password) {
      await ctx.reply(t(s.lang).loginUsage);
      return;
    }
    await ctx.reply(t(s.lang).loginChecking);
    try {
      const { cookie, user, business } = await PulseApi.login(username, password);
      s.cookie = cookie;
      s.user = user;
      s.business = business;
      sessions.save(ctx.chat.id, s);
      await ctx.reply(t(s.lang).loginSuccess(business.name, user.role));
    } catch (err) {
      const reason = err instanceof ApiError ? err.message : 'unknown error';
      logger.warn(`Login failed for chat ${ctx.chat.id}: ${reason}`);
      await ctx.reply(t(s.lang).loginFailed(reason));
    }
  });

  bot.command('logout', async (ctx) => {
    const s = sessions.get(ctx.chat.id);
    if (s.cookie) {
      await new PulseApi(s.cookie).logout().catch(() => undefined);
    }
    sessions.clearAuth(ctx.chat.id);
    await ctx.reply(t(s.lang).logout);
  });

  bot.command('whoami', async (ctx) => {
    const s = sessions.get(ctx.chat.id);
    if (!s.cookie || !s.user || !s.business) {
      await ctx.reply(t(s.lang).notLoggedIn);
      return;
    }
    await ctx.reply(t(s.lang).whoami(s.user.username, s.business.name, s.user.role));
  });

  bot.command('products', async (ctx) => {
    const s = sessions.get(ctx.chat.id);
    if (!s.cookie) {
      await ctx.reply(t(s.lang).needLogin);
      return;
    }
    try {
      const { products } = await new PulseApi(s.cookie).products();
      if (products.length === 0) {
        await ctx.reply(t(s.lang).noProducts);
        return;
      }
      const lines = [t(s.lang).productsTitle, ''];
      for (const p of products.slice(0, 40)) {
        const size = p.packageSize ? ` ${escapeHtml(p.packageSize)}` : '';
        lines.push(`• <b>${escapeHtml(p.name)}</b>${size} — ${formatMMK(p.currentPrice)} MMK`);
      }
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
    } catch (err) {
      logger.error('Failed to list products:', err);
      await ctx.reply(t(s.lang).error);
    }
  });

  bot.command('drafts', async (ctx) => {
    const s = sessions.get(ctx.chat.id);
    if (!s.cookie) {
      await ctx.reply(t(s.lang).needLogin);
      return;
    }
    try {
      const { drafts } = await new PulseApi(s.cookie).bootstrap();
      const pending = drafts.filter((d) => d.status === 'pending');
      if (pending.length === 0) {
        await ctx.reply(t(s.lang).noDrafts);
        return;
      }
      const lines = [t(s.lang).draftsTitle, ''];
      for (const d of pending.slice(0, 20)) {
        lines.push(`• <b>${escapeHtml(d.productName || t(s.lang).unknown)}</b> — ${formatMMK(d.newPrice)} MMK`);
      }
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
    } catch (err) {
      logger.error('Failed to list drafts:', err);
      await ctx.reply(t(s.lang).error);
    }
  });
}
