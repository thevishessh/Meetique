import { prisma } from "@/lib/db";
import { hashPassword, requireApiUser } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { staffCreateSchema } from "@/lib/validation";

/** Admins, receptionists and staff members (officers are created via /api/officers) */
export const POST = handle(async (req: Request) => {
  const admin = await requireApiUser("ADMIN");
  const d = staffCreateSchema.parse(await readJson(req));
  if (await prisma.user.findUnique({ where: { email: d.email } })) return fail(409, "EMAIL_TAKEN", "An account with this email already exists");
  if (d.employeeId && (await prisma.user.findFirst({ where: { organizationId: admin.organizationId, employeeId: d.employeeId } }))) {
    return fail(409, "L_CODE_TAKEN", "Another account already has this L Code");
  }
  if (d.departmentId && !(await prisma.department.findFirst({ where: { id: d.departmentId, organizationId: admin.organizationId } }))) {
    return fail(422, "VALIDATION", "Unknown department");
  }
  const u = await prisma.user.create({
    data: {
      organizationId: admin.organizationId, name: d.name, email: d.email, role: d.role, passwordHash: await hashPassword(d.password),
      employeeId: d.employeeId, jobTitle: d.jobTitle, phone: d.phone, departmentId: d.departmentId,
    },
  });
  return ok({ id: u.id }, 201);
});
