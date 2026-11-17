import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { orgUpdateSchema } from "@/lib/validation";

export const PATCH = handle(async (req: Request) => {
  const user = await requireApiUser("ADMIN");
  const d = orgUpdateSchema.parse(await readJson(req));
  const org = await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      name: d.name,
      timezone: d.timezone,
      email: d.email || null,
      phone: d.phone || null,
      address: d.address || null,
      ...(d.visitorCategories !== undefined ? { visitorCategories: d.visitorCategories } : {}),
      ...(d.referenceLabel !== undefined ? { referenceLabel: d.referenceLabel || null } : {}),
    },
  });
  return ok(org);
});
