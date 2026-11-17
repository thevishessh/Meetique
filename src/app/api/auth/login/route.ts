import { prisma } from "@/lib/db";
import { createSession, homeFor, verifyPassword } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { loginSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  const { email, password } = loginSchema.parse(await readJson(req));
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    return fail(401, "INVALID_CREDENTIALS", "Incorrect email or password");
  }
  await createSession(user.id);
  return ok({ redirect: homeFor(user.role), role: user.role });
});
