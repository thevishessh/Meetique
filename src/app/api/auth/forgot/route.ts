import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { handle, ok, readJson, fail } from "@/lib/api";
import { forgotSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { emailConfigured, sendEmail } from "@/lib/mailer";
import { APP_NAME, APP_URL } from "@/lib/config";

const VALID_MIN = 30;

/**
 * POST /api/auth/forgot { email }
 * Always answers the same way (so nobody can test which emails exist). If the account exists,
 * a one-time link valid for 30 minutes is emailed. Only a SHA-256 hash of the token is stored.
 */
export const POST = handle(async (req: Request) => {
  if (!rateLimit(`forgot:${clientIp(req)}`, 10, 15 * 60_000).ok) return fail(429, "TOO_MANY_ATTEMPTS", "Too many requests. Try again later.");
  const { email } = forgotSchema.parse(await readJson(req));
  const generic = { message: "If an account exists for that email, a password reset link has been sent. It is valid for 30 minutes." };
  if (!rateLimit(`forgot:${email}`, 3, 15 * 60_000).ok) return ok(generic);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return ok(generic);

  const token = randomBytes(32).toString("base64url");
  await prisma.passwordReset.create({
    data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + VALID_MIN * 60_000) },
  });
  const link = `${APP_URL}/reset-password/${token}`;
  await sendEmail(
    user.email,
    `${APP_NAME}: reset your password`,
    `Hello ${user.name},\n\nUse this link to set a new password (valid for ${VALID_MIN} minutes, works once):\n${link}\n\nIf you didn't ask for this, ignore this email — your password stays the same.\n\n— ${APP_NAME}`,
  );
  // Development only: without email set up, hand the link back so the flow can be tested
  const dev = process.env.NODE_ENV !== "production" && !emailConfigured();
  if (dev) console.info(`[dev] password reset link for ${email}: ${link}`);
  return ok(dev ? { ...generic, devLink: link } : generic);
});
