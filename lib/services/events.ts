import crypto from 'crypto';
import { DatabaseSchema } from '../seed/demo';
import { AuditLog, InAppNotification, NotificationType, UserRole } from '../types';

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

export function recordAudit(
  data: DatabaseSchema,
  entry: {
    actorId: string;
    actorName: string;
    actorRole: UserRole | 'system';
    action: string;
    targetType: string;
    targetId: string;
    details?: Record<string, unknown>;
    isDemo?: boolean;
  }
): AuditLog {
  const log: AuditLog = {
    id: id('audit'),
    actorId: entry.actorId,
    actorName: entry.actorName,
    actorRole: entry.actorRole,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    details: entry.details,
    timestamp: new Date().toISOString(),
    isDemo: entry.isDemo ?? false,
  };
  data.auditLogs[log.id] = log;
  return log;
}

/**
 * Create a persistent in-app notification. When dedupeKey is supplied, a second
 * notification with the same (recipientId, dedupeKey) will NOT be created, so
 * retries are idempotent.
 */
export function createNotification(
  data: DatabaseSchema,
  entry: {
    recipientId: string;
    title: string;
    body: string;
    type: NotificationType;
    link?: string;
    payload?: Record<string, unknown>;
    dedupeKey?: string;
    isDemo?: boolean;
  }
): InAppNotification | null {
  if (entry.dedupeKey) {
    const exists = Object.values(data.notifications).some(
      (n) => n.recipientId === entry.recipientId && n.dedupeKey === entry.dedupeKey
    );
    if (exists) return null;
  }

  const notification: InAppNotification = {
    id: id('notif'),
    recipientId: entry.recipientId,
    title: entry.title,
    body: entry.body,
    type: entry.type,
    link: entry.link,
    data: entry.payload,
    read: false,
    dedupeKey: entry.dedupeKey,
    createdAt: new Date().toISOString(),
    isDemo: entry.isDemo ?? false,
  };
  data.notifications[notification.id] = notification;
  return notification;
}
