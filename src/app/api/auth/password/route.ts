import { prisma } from "@/lib/db";
import { getUser, hashPassword, verifyPassword } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { passwordChangeSchema } from "@/lib/validation";

/** POST /api/auth/password { currentPassword, newPassword } — any signed-in user (also while a change is required) */
export const POST = handle(async (req: Request) => {
  const user = await getUser();
  if (!user) return fail(401, "UNAUTHORIZED", "Please sign in");
  const d = passwordChangeSchema.parse(await readJson(req));
  const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(d.currentPassword, u.passwordHash))) return fail(401, "WRONG_PASSWORD", "Current password is incorrect");
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(d.newPassword), mustChangePassword: false } });
  return ok({ ok: true });
});
