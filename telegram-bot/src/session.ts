import { config } from './config';
import type { Lang } from './i18n';
import type { Business, BotUser } from './types';

/**
 * Per-chat state. Kept in memory only — credentials/sessions are never written
 * to disk, and are dropped when the process restarts or the user /logout's.
 */
export interface ChatSession {
  lang: Lang;
  cookie: string | null;
  user: BotUser | null;
  business: Business | null;
}

class SessionStore {
  private readonly map = new Map<number, ChatSession>();

  get(chatId: number): ChatSession {
    let session = this.map.get(chatId);
    if (!session) {
      session = { lang: config.defaultLang, cookie: null, user: null, business: null };
      this.map.set(chatId, session);
    }
    return session;
  }

  save(chatId: number, session: ChatSession): void {
    this.map.set(chatId, session);
  }

  clearAuth(chatId: number): void {
    const session = this.get(chatId);
    session.cookie = null;
    session.user = null;
    session.business = null;
    this.map.set(chatId, session);
  }

  isAuthed(chatId: number): boolean {
    return Boolean(this.get(chatId).cookie);
  }
}

export const sessions = new SessionStore();
