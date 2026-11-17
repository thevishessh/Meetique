import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";

/** Mark all as read */
export const POST = handle(async () => {
  const user = await requireApiUser();
  await prisma.userNotification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return ok({ ok: true });
});
