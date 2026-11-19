import { prisma } from "./db";
import { getUser, type SessionUser } from "./auth";
import { PUBLIC_BOOKING } from "./config";
import { AppError } from "./errors";

/**
 * Organization a read-only booking API may answer for.
 * Public mode: anyone, by slug. Internal mode: only signed-in members of that organization.
 */
export async function readableOrg(slug: string | null): Promise<{ orgId: string; user: SessionUser | null }> {
  const user = await getUser();
  const orgId = slug ? (await prisma.organization.findUnique({ where: { slug }, select: { id: true } }))?.id : user?.organizationId;
  if (!orgId) throw new AppError("NOT_FOUND", "Organization not found", 404);
  if (!PUBLIC_BOOKING && (!user || user.organizationId !== orgId || user.mustChangePassword)) throw new AppError("UNAUTHORIZED", "Please sign in", 401);
  return { orgId, user };
}
