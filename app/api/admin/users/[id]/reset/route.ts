import { NextRequest } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { guard, json, fail, handleError } from '@/lib/api/http';
import { hashPassword } from '@/lib/auth/password';
import { recordAudit } from '@/lib/services/events';
import crypto from 'crypto';

/**
 * Administrator-assisted password reset.
 * Generates a ONE-TIME reset token. The token is returned to the admin once and
 * must be shared with the user out-of-band. The admin never sees or sets the
 * user's password. The token is stored only as a hash with a 30-minute expiry.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbStore.ready();
    const g = guard(req, ['admin']);
    if (g.response) return g.response;
    const ctx = g.ctx!;

    return await dbStore.exclusive(async () => {
      const data = dbStore.getData();
      const user = data.users[params.id];
      if (!user) return fail('NOT_FOUND', 'User not found.', 404);

      const token = crypto.randomBytes(9).toString('base64url');
      const { passwordHash, passwordSalt } = hashPassword(token);
      user.resetTokenHash = passwordHash;
      user.resetTokenSalt = passwordSalt;
      user.resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      data.users[user.id] = user;

      recordAudit(data, {
        actorId: ctx.user.id, actorName: ctx.business.name, actorRole: ctx.user.role,
        action: 'PASSWORD_RESET_ISSUED', targetType: 'USER', targetId: user.id,
        details: { expiresAt: user.resetTokenExpiresAt }, isDemo: user.isDemo,
      });

      return json({
        success: true,
        username: user.username,
        resetToken: token,
        expiresAt: user.resetTokenExpiresAt,
        note: 'Share this one-time token with the user out-of-band. It expires in 30 minutes and is not the password.',
      });
    });
  } catch (e) {
    return handleError(e);
  }
}
