import { prisma } from "@/lib/db";
import { hashPassword, requireApiUser } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { staffCreateSchema } from "@/lib/validation";

/** Admins and receptionists (officers are created via /api/officers) */
export const POST = handle(async (req: Request) => {
  const admin = await requireApiUser("ADMIN");
  const d = staffCreateSchema.parse(await readJson(req));
  if (await prisma.user.findUnique({ where: { email: d.email } })) return fail(409, "EMAIL_TAKEN", "An account with this email already exists");
  const u = await prisma.user.create({
    data: { organizationId: admin.organizationId, name: d.name, email: d.email, role: d.role, passwordHash: await hashPassword(d.password) },
  });
  return ok({ id: u.id }, 201);
});
