import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { fail, handle, ok } from "@/lib/api";
import { resolveOfficer } from "@/lib/scope";

export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser("ADMIN", "OFFICER");
  const block = await prisma.availabilityBlock.findUnique({ where: { id: (await params).id } });
  if (!block) return fail(404, "NOT_FOUND", "Block not found");
  await resolveOfficer(user, block.officerId);
  await prisma.availabilityBlock.delete({ where: { id: block.id } });
  return ok({ ok: true });
});
