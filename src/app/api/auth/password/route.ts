import { prisma } from "@/lib/db";
import { hashPassword, requireApiUser, verifyPassword } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { passwordChangeSchema } from "@/lib/validation";

/** POST /api/auth/password { currentPassword, newPassword } — any signed-in staff member */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const d = passwordChangeSchema.parse(await readJson(req));
  const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(d.currentPassword, u.passwordHash))) return fail(401, "WRONG_PASSWORD", "Current password is incorrect");
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(d.newPassword) } });
  return ok({ ok: true });
});
