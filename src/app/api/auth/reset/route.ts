import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { resetSchema } from "@/lib/validation";

/** POST /api/auth/reset { token, password } — completes a forgot-password link */
export const POST = handle(async (req: Request) => {
  const { token, password } = resetSchema.parse(await readJson(req));
  const r = await prisma.passwordReset.findUnique({ where: { tokenHash: createHash("sha256").update(token).digest("hex") }, include: { user: true } });
  if (!r || r.usedAt || r.expiresAt < new Date() || !r.user.isActive) return fail(400, "INVALID_LINK", "This reset link is invalid or has expired. Please request a new one.");
  await prisma.$transaction([
    prisma.user.update({ where: { id: r.userId }, data: { passwordHash: await hashPassword(password), mustChangePassword: false, failedLoginCount: 0, lockedUntil: null } }),
    prisma.passwordReset.update({ where: { id: r.id }, data: { usedAt: new Date() } }),
    prisma.passwordReset.deleteMany({ where: { userId: r.userId, usedAt: null } }),
  ]);
  return ok({ ok: true });
});
