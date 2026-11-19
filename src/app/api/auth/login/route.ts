import { prisma } from "@/lib/db";
import { createSession, homeFor, verifyPassword } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { clientIp, peek, rateLimit } from "@/lib/rate-limit";

const MAX_FAILS = 5; // wrong passwords before the account is locked
const LOCK_MINUTES = 15;
/** Wrong passwords allowed per IP per 15 min (only with TRUST_PROXY). Only failures count: a campus often shares one IP. */
const IP_FAIL_LIMIT = 100;
const IP_WINDOW_MS = 15 * 60_000;
/** Compared against when the email is unknown, so every failure costs the same bcrypt time */
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8DbHnI3V6yG4z3YkBz2E9XwX5S0J2a";
/** One answer for wrong password, unknown email and locked account, so accounts cannot be probed */
const GENERIC = "Incorrect email or password. After 5 wrong tries the account is locked for 15 minutes; the IT admin can reset it.";

export const POST = handle(async (req: Request) => {
  const ip = clientIp(req);
  const ipKey = ip ? `login-fail:${ip}` : null;
  if (ipKey && peek(ipKey) >= IP_FAIL_LIMIT) return fail(429, "TOO_MANY_ATTEMPTS", "Too many failed sign-in attempts from this network. Try again in 15 minutes.");

  const { email, password } = loginSchema.parse(await readJson(req));
  const user = await prisma.user.findUnique({ where: { email } });
  const invalid = () => {
    if (ipKey) rateLimit(ipKey, IP_FAIL_LIMIT, IP_WINDOW_MS);
    return fail(401, "INVALID_CREDENTIALS", GENERIC);
  };

  const matches = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.isActive) return invalid();
  if (user.lockedUntil && user.lockedUntil > new Date()) return invalid();

  if (!matches) {
    const fails = user.failedLoginCount + 1;
    const lock = fails >= MAX_FAILS;
    await prisma.user.update({
      where: { id: user.id },
      data: lock ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLoginCount: fails },
    });
    return invalid();
  }

  if (user.failedLoginCount || user.lockedUntil) await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  await createSession(user.id);
  return ok({ redirect: user.mustChangePassword ? "/change-password" : homeFor(user.role), role: user.role });
});
