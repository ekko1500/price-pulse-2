import { Telegraf } from 'telegraf';
import { config } from './config';
import { logger } from './logger';
import { registerCommands } from './handlers/commands';
import { registerPrice } from './handlers/price';
import { registerCallbacks } from './handlers/callbacks';

/**
 * PricePulse Myanmar Telegram bot.
 *
 * Wholesalers chat a supplier message (Burmese / English / mixed); the bot calls
 * the existing PricePulse web API, which runs Gemini extraction and stores a
 * pending draft. The wholesaler reviews it in chat and presses Publish — reusing
 * the exact same validation, audit and notification pipeline as the web app.
 */
async function main(): Promise<void> {
  const bot = new Telegraf(config.botToken);

  // Order matters: commands first, then the catch-all free-text handler.
  registerCommands(bot);
  registerCallbacks(bot);
  registerPrice(bot);

  bot.catch((err, ctx) => {
    logger.error('Unhandled bot error:', err);
    ctx.reply('⚠️ Something went wrong. Please try again.').catch(() => undefined);
  });

  await bot.telegram
    .setMyCommands([
      { command: 'start', description: 'Start the bot' },
      { command: 'login', description: 'Sign in to PricePulse' },
      { command: 'price', description: 'Extract a price update from a message' },
      { command: 'products', description: 'List your wholesale catalog' },
      { command: 'drafts', description: 'List pending price drafts' },
      { command: 'whoami', description: 'Show the signed-in account' },
      { command: 'lang', description: 'Switch language (en/my)' },
      { command: 'logout', description: 'Sign out' },
      { command: 'help', description: 'How to use the bot' },
    ])
    .catch((err) => logger.warn('Could not register command menu:', err));

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, stopping bot…`);
    bot.stop(signal);
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  await bot.launch({}, () => {
    logger.info(`PricePulse Telegram bot is running. Web API: ${config.apiUrl}`);
  });
}

main().catch((err) => {
  logger.error('Fatal startup error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
