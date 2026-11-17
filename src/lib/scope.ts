import { prisma } from "./db";
import { AppError } from "./errors";
import type { SessionUser } from "./auth";

/** Admin may act on any officer in their org; an officer only on themself. */
export async function resolveOfficer(user: SessionUser, officerId?: string | null) {
  const id = officerId || user.officerId;
  if (!id) throw new AppError("BAD_REQUEST", "officerId is required", 400);
  if (user.role === "OFFICER" && id !== user.officerId) throw new AppError("FORBIDDEN", "You can only manage your own availability", 403);
  if (user.role === "RECEPTIONIST") throw new AppError("FORBIDDEN", "Not allowed", 403);
  const officer = await prisma.officerProfile.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!officer) throw new AppError("NOT_FOUND", "Officer not found", 404);
  return officer;
}
