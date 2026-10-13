import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { json, fail, readJson, handleError } from '@/lib/api/http';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { isStrongEnoughPassword } from '@/lib/validation';
import { recordAudit } from '@/lib/services/events';

/**
 * Complete an administrator-assisted reset using the one-time token, then set a
 * new password. The old password is never revealed; the token is single-use.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const username = String(body.username ?? '').trim().toLowerCase();
    const token = String(body.token ?? '');
    const newPassword = String(body.newPassword ?? '');

    if (!username || !token) return fail('VALIDATION', 'Username and reset token are required.', 422);
    if (!isStrongEnoughPassword(newPassword)) {
      return fail('VALIDATION', 'Password must be at least 8 characters and include a letter and a number.', 422);
    }

    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const user = Object.values(data.users).find((u) => u.username.toLowerCase() === username);
      // Generic failure to avoid account enumeration.
      if (!user || !user.resetTokenHash || !user.resetTokenSalt) {
        return fail('INVALID_TOKEN', 'Invalid or expired reset token.', 400);
      }
      if (!user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt).getTime() < Date.now()) {
        return fail('INVALID_TOKEN', 'Invalid or expired reset token.', 400);
      }
      if (!verifyPassword(token, user.resetTokenHash, user.resetTokenSalt)) {
        return fail('INVALID_TOKEN', 'Invalid or expired reset token.', 400);
      }

      const { passwordHash, passwordSalt } = hashPassword(newPassword);
      user.passwordHash = passwordHash;
      user.passwordSalt = passwordSalt;
      delete user.resetTokenHash;
      delete user.resetTokenSalt;
      delete user.resetTokenExpiresAt;
      data.users[user.id] = user;

      // Invalidate existing sessions for that user.
      for (const [tok, s] of Object.entries(data.sessions)) {
        if (s.userId === user.id) delete data.sessions[tok];
      }

      recordAudit(data, {
        actorId: user.id, actorName: data.businesses[user.businessId]?.name ?? user.username,
        actorRole: user.role, action: 'PASSWORD_RESET_COMPLETED', targetType: 'USER', targetId: user.id,
        isDemo: user.isDemo,
      });
      return json({ success: true });
    });
  } catch (e) {
    return handleError(e);
  }
}
