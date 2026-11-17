import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { departmentSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

async function own(orgId: string, id: string) {
  return prisma.department.findFirst({ where: { id, organizationId: orgId } });
}

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser("ADMIN");
  const dep = await own(user.organizationId, (await params).id);
  if (!dep) return fail(404, "NOT_FOUND", "Department not found");
  const d = departmentSchema.parse(await readJson(req));
  return ok(await prisma.department.update({ where: { id: dep.id }, data: { name: d.name, description: d.description || null } }));
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser("ADMIN");
  const dep = await own(user.organizationId, (await params).id);
  if (!dep) return fail(404, "NOT_FOUND", "Department not found");
  await prisma.department.delete({ where: { id: dep.id } }); // officers keep working, department set to null
  return ok({ ok: true });
});
