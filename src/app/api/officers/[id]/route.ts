import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { officerUpdateSchema } from "@/lib/validation";
import { resolveOfficer } from "@/lib/scope";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser("ADMIN", "OFFICER");
  const officer = await resolveOfficer(user, (await params).id);
  const d = officerUpdateSchema.parse(await readJson(req));
  if (user.role !== "ADMIN" && (d.isActive !== undefined || d.departmentId !== undefined || d.canSummon !== undefined)) {
    return fail(403, "FORBIDDEN", "Only an admin can change department, account status or immediate-meeting rights");
  }
  if (d.departmentId && !(await prisma.department.findFirst({ where: { id: d.departmentId, organizationId: user.organizationId } }))) {
    return fail(422, "VALIDATION", "Unknown department");
  }
  if (d.employeeId && (await prisma.user.findFirst({ where: { organizationId: user.organizationId, employeeId: d.employeeId, NOT: { id: officer.userId } } }))) {
    return fail(409, "L_CODE_TAKEN", "Another account already has this L Code");
  }
  const { name, phone, isActive, employeeId, ...profile } = d;
  if (profile.maxDurationMin !== undefined) profile.maxDurationMin = Math.max(profile.maxDurationMin, profile.slotDurationMin ?? officer.slotDurationMin);
  await prisma.$transaction([
    prisma.officerProfile.update({ where: { id: officer.id }, data: { ...profile, departmentId: d.departmentId === undefined ? undefined : d.departmentId || null } }),
    prisma.user.update({ where: { id: officer.userId }, data: { name, phone, isActive, employeeId, ...(isActive === false ? { sessionVersion: { increment: 1 } } : {}) } }),
  ]);
  return ok({ ok: true });
});

/** Deactivates (never hard-deletes — appointment history is kept) */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser("ADMIN");
  const officer = await resolveOfficer(user, (await params).id);
  await prisma.user.update({ where: { id: officer.userId }, data: { isActive: false, sessionVersion: { increment: 1 } } });
  await prisma.officerProfile.update({ where: { id: officer.id }, data: { isBookable: false } });
  return ok({ ok: true });
});
