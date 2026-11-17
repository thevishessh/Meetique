import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";

const sub = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }) });

/** Save this device for phone/desktop alerts */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const d = sub.parse(await readJson(req));
  const ua = req.headers.get("user-agent")?.slice(0, 200) ?? null;
  await prisma.pushSubscription.upsert({
    where: { endpoint: d.endpoint },
    create: { userId: user.id, endpoint: d.endpoint, p256dh: d.keys.p256dh, auth: d.keys.auth, userAgent: ua },
    update: { userId: user.id, p256dh: d.keys.p256dh, auth: d.keys.auth, userAgent: ua },
  });
  return ok({ ok: true, devices: await prisma.pushSubscription.count({ where: { userId: user.id } }) });
});

/** Stop alerts on this device */
export const DELETE = handle(async (req: Request) => {
  const user = await requireApiUser();
  const { endpoint } = z.object({ endpoint: z.string().min(1) }).parse(await readJson(req));
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return ok({ ok: true });
});
