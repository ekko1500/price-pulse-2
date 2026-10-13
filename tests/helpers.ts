import { buildDemoData, DatabaseSchema } from '@/lib/seed/demo';
import { AuthContext } from '@/lib/auth/session';
import { UserRole } from '@/lib/types';

export function freshData(): DatabaseSchema {
  return buildDemoData();
}

export function ctxFor(data: DatabaseSchema, userId: string): AuthContext {
  const user = data.users[userId];
  if (!user) throw new Error(`No demo user ${userId}`);
  const { passwordHash, passwordSalt, ...pub } = user;
  void passwordHash;
  void passwordSalt;
  return { user: pub, business: data.businesses[user.businessId], isDemo: user.isDemo };
}

export function roleOf(data: DatabaseSchema, userId: string): UserRole {
  return data.users[userId].role;
}

export function notificationsFor(data: DatabaseSchema, recipientId: string) {
  return Object.values(data.notifications).filter((n) => n.recipientId === recipientId);
}

export function stockOf(data: DatabaseSchema, inventoryId: string): number {
  return data.inventory[inventoryId].currentStock;
}
