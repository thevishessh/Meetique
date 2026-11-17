import { prisma } from "@/lib/db";
import { createSession, homeFor, verifyPassword } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { clientIp, peek, rateLimit } from "@/lib/rate-limit";

const MAX_FAILS = 5; // wrong passwords before the account is locked
const LOCK_MINUTES = 15;
/** Wrong passwords allowed per IP per 15 min. Only failures count — a whole campus often shares one IP. */
const IP_FAIL_LIMIT = 100;
const IP_WINDOW_MS = 15 * 60_000;

export const POST = handle(async (req: Request) => {
  // 1. Per-IP throttle on failed attempts: stops one machine from guessing across many accounts
  const ipKey = `login-fail:${clientIp(req)}`;
  if (peek(ipKey) >= IP_FAIL_LIMIT) return fail(429, "TOO_MANY_ATTEMPTS", "Too many failed sign-in attempts from this network. Try again in 15 minutes.");

  const { email, password } = loginSchema.parse(await readJson(req));
  const user = await prisma.user.findUnique({ where: { email } });
  const invalid = () => {
    rateLimit(ipKey, IP_FAIL_LIMIT, IP_WINDOW_MS);
    return fail(401, "INVALID_CREDENTIALS", "Incorrect email or password");
  };
  if (!user || !user.isActive) return invalid();

  // 2. Per-account lockout after repeated wrong passwords
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return fail(423, "LOCKED", `Too many wrong passwords. This account is locked for ${mins} more minute${mins === 1 ? "" : "s"}, or ask the IT admin to reset your password.`);
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    rateLimit(ipKey, IP_FAIL_LIMIT, IP_WINDOW_MS);
    const fails = user.failedLoginCount + 1;
    const lock = fails >= MAX_FAILS;
    await prisma.user.update({
      where: { id: user.id },
      data: lock ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLoginCount: fails },
    });
    if (lock) return fail(423, "LOCKED", `Too many wrong passwords. This account is locked for ${LOCK_MINUTES} minutes.`);
    const left = MAX_FAILS - fails;
    return fail(401, "INVALID_CREDENTIALS", `Incorrect email or password${left <= 2 ? ` — ${left} attempt${left === 1 ? "" : "s"} left before the account is locked` : ""}`);
  }

  if (user.failedLoginCount || user.lockedUntil) await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  await createSession(user.id);
  return ok({ redirect: user.mustChangePassword ? "/change-password" : homeFor(user.role), role: user.role });
});
