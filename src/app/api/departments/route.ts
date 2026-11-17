import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUser, requireApiUser } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { departmentSchema } from "@/lib/validation";

export const GET = handle(async (req: NextRequest) => {
  const slug = req.nextUrl.searchParams.get("org");
  const orgId = slug ? (await prisma.organization.findUnique({ where: { slug } }))?.id : (await getUser())?.organizationId;
  if (!orgId) return fail(404, "NOT_FOUND", "Organization not found");
  return ok(await prisma.department.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }));
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser("ADMIN");
  const d = departmentSchema.parse(await readJson(req));
  if (await prisma.department.findFirst({ where: { organizationId: user.organizationId, name: d.name } })) return fail(409, "EXISTS", "Department already exists");
  return ok(await prisma.department.create({ data: { organizationId: user.organizationId, name: d.name, description: d.description || null } }), 201);
});
