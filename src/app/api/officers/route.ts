import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, requireApiUser } from "@/lib/auth";
import { readableOrg } from "@/lib/org-access";
import { fail, handle, ok, readJson } from "@/lib/api";
import { officerCreateSchema } from "@/lib/validation";
import { AppError } from "@/lib/errors";

/** GET /api/officers?org=<slug>&department=<id> — public list of bookable officers (or all, for staff) */
export const GET = handle(async (req: NextRequest) => {
  const slug = req.nextUrl.searchParams.get("org");
  const departmentId = req.nextUrl.searchParams.get("department") || undefined;
  const { orgId, user } = await readableOrg(slug);
  const isStaff = user?.organizationId === orgId;

  const officers = await prisma.officerProfile.findMany({
    where: { organizationId: orgId, departmentId, ...(isStaff ? {} : { isBookable: true, user: { isActive: true } }) },
    include: { user: { select: { name: true, ...(isStaff ? { email: true, isActive: true } : {}) } }, department: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return ok(
    officers.map((o) => ({
      id: o.id,
      name: o.user.name,
      designation: o.designation,
      department: o.department,
      location: o.location,
      slotDurationMin: o.slotDurationMin,
      ...(isStaff ? { email: (o.user as { email?: string }).email, isActive: (o.user as { isActive?: boolean }).isActive, isBookable: o.isBookable } : {}),
    })),
  );
});

/** POST /api/officers — admin creates an officer account + profile with default Mon–Sat 10:00–14:00 hours */
export const POST = handle(async (req: Request) => {
  const admin = await requireApiUser("ADMIN");
  const d = officerCreateSchema.parse(await readJson(req));
  if (await prisma.user.findUnique({ where: { email: d.email } })) return fail(409, "EMAIL_TAKEN", "An account with this email already exists");
  if (await prisma.user.findFirst({ where: { organizationId: admin.organizationId, employeeId: d.employeeId } })) return fail(409, "L_CODE_TAKEN", "Another account already has this L Code");
  if (d.departmentId && !(await prisma.department.findFirst({ where: { id: d.departmentId, organizationId: admin.organizationId } }))) {
    return fail(422, "VALIDATION", "Unknown department");
  }
  const user = await prisma.user.create({
    data: {
      organizationId: admin.organizationId,
      name: d.name,
      email: d.email,
      employeeId: d.employeeId,
      phone: d.phone || null,
      passwordHash: await hashPassword(d.password),
      role: "OFFICER",
      officerProfile: {
        create: {
          organizationId: admin.organizationId,
          designation: d.designation,
          departmentId: d.departmentId || null,
          location: d.location || null,
          workingHours: {
            create: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: "10:00", endTime: "14:00", breakStart: "12:00", breakEnd: "12:30" })),
          },
        },
      },
    },
    include: { officerProfile: true },
  });
  return ok({ id: user.officerProfile!.id, userId: user.id }, 201);
});
