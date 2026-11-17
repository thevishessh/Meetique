import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { fail, handle, ok } from "@/lib/api";

export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser("ADMIN");
  const h = await prisma.orgHoliday.findFirst({ where: { id: (await params).id, organizationId: user.organizationId } });
  if (!h) return fail(404, "NOT_FOUND", "Holiday not found");
  await prisma.orgHoliday.delete({ where: { id: h.id } });
  return ok({ ok: true });
});
