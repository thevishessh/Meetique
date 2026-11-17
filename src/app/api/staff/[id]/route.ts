import { prisma } from "@/lib/db";
import { hashPassword, requireApiUser } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { staffUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const admin = await requireApiUser("ADMIN");
  const id = (await params).id;
  const target = await prisma.user.findFirst({ where: { id, organizationId: admin.organizationId } });
  if (!target) return fail(404, "NOT_FOUND", "User not found");
  const d = staffUpdateSchema.parse(await readJson(req));
  if (target.id === admin.id && d.isActive === false) return fail(409, "SELF", "You cannot deactivate your own account");
  await prisma.user.update({
    where: { id },
    data: {
      name: d.name,
      isActive: d.isActive,
      employeeId: d.employeeId,
      jobTitle: d.jobTitle,
      phone: d.phone,
      departmentId: d.departmentId,
      ...(d.password ? { passwordHash: await hashPassword(d.password) } : {}),
    },
  });
  if (target.role === "OFFICER" && d.isActive === false) await prisma.officerProfile.updateMany({ where: { userId: id }, data: { isBookable: false } });
  return ok({ ok: true });
});
