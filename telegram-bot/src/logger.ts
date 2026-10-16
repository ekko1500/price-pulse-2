/** Minimal leveled logger. */

const level = (process.env.LOG_LEVEL || 'info').toLowerCase();

const order: Record<string, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = order[level] ?? order.info;

function ts(): string {
  return new Date().toISOString();
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (threshold <= order.debug) console.debug(`[${ts()}] [debug]`, ...args);
  },
  info: (...args: unknown[]) => {
    if (threshold <= order.info) console.log(`[${ts()}] [info]`, ...args);
  },
  warn: (...args: unknown[]) => {
    if (threshold <= order.warn) console.warn(`[${ts()}] [warn]`, ...args);
  },
  error: (...args: unknown[]) => {
    if (threshold <= order.error) console.error(`[${ts()}] [error]`, ...args);
  },
};
