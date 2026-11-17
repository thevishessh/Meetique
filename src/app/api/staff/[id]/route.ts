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
  if (d.employeeId && (await prisma.user.findFirst({ where: { organizationId: admin.organizationId, employeeId: d.employeeId, NOT: { id } } }))) {
    return fail(409, "L_CODE_TAKEN", "Another account already has this L Code");
  }
  if (d.paOfficerId !== undefined && d.paOfficerId !== null) {
    if (target.role !== "STAFF") return fail(422, "VALIDATION", "Only a staff member can be made an officer's PA");
    if (!(await prisma.officerProfile.findFirst({ where: { id: d.paOfficerId, organizationId: admin.organizationId } }))) return fail(404, "NOT_FOUND", "Officer not found");
  }
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
      paOfficerId: d.paOfficerId,
      ...(d.password ? { passwordHash: await hashPassword(d.password), mustChangePassword: true, failedLoginCount: 0, lockedUntil: null } : {}),
    },
  });
  if (target.role === "OFFICER" && d.isActive === false) await prisma.officerProfile.updateMany({ where: { userId: id }, data: { isBookable: false } });
  return ok({ ok: true });
});
