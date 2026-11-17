import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";

/** Latest notifications for the bell */
export const GET = handle(async () => {
  const user = await requireApiUser();
  const [items, unread] = await Promise.all([
    prisma.userNotification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.userNotification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return ok({ unread, items });
});
