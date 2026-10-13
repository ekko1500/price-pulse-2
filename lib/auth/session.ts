import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '../db/store';
import { Business, PublicUser, Session, User } from '../types';

export const SESSION_COOKIE = 'pp_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/** Strip credentials before anything is sent to the browser. */
export function toPublicUser(user: User): PublicUser {
  const { passwordHash, passwordSalt, ...rest } = user;
  void passwordHash;
  void passwordSalt;
  return rest;
}

export function createSession(user: User): Session {
  const now = Date.now();
  const session: Session = {
    token: crypto.randomBytes(32).toString('hex'),
    userId: user.id,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    isDemo: user.isDemo,
  };
  dbStore.getData().sessions[session.token] = session;
  dbStore.persist();
  return session;
}

export function destroySession(token: string | undefined): void {
  if (!token) return;
  const sessions = dbStore.getData().sessions;
  if (sessions[token]) {
    delete sessions[token];
    dbStore.persist();
  }
}

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export interface AuthContext {
  user: PublicUser;
  business: Business;
  isDemo: boolean;
}

/**
 * Resolve the authenticated user for a request. Returns null when there is no
 * valid, unexpired session pointing at an active user. This is the single source
 * of truth for authorization - never trust client-supplied roles or ids.
 */
export function getAuthContext(req: NextRequest): AuthContext | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const data = dbStore.getData();
  const session = data.sessions[token];
  if (!session) return null;

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    delete data.sessions[token];
    dbStore.persist();
    return null;
  }

  const user = data.users[session.userId];
  if (!user || !user.isActive) return null;

  const business = data.businesses[user.businessId];
  if (!business) return null;

  return { user: toPublicUser(user), business, isDemo: user.isDemo };
}

export function requireAuth(req: NextRequest): AuthContext | null {
  return getAuthContext(req);
}
