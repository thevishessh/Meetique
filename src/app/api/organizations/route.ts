import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { orgRegisterSchema } from "@/lib/validation";

/** Organization registration: creates the org + its first admin and signs them in */
export const POST = handle(async (req: Request) => {
  const d = orgRegisterSchema.parse(await readJson(req));
  if (await prisma.organization.findUnique({ where: { slug: d.slug } })) return fail(409, "SLUG_TAKEN", "That booking URL is already taken");
  if (await prisma.user.findUnique({ where: { email: d.email } })) return fail(409, "EMAIL_TAKEN", "An account with this email already exists");

  const org = await prisma.organization.create({
    data: {
      name: d.orgName,
      slug: d.slug,
      shortCode: d.shortCode,
      timezone: d.timezone,
      users: { create: { name: d.adminName, email: d.email, passwordHash: await hashPassword(d.password), role: "ADMIN" } },
    },
    include: { users: true },
  });
  await createSession(org.users[0].id);
  return ok({ id: org.id, slug: org.slug, redirect: "/admin" }, 201);
});
