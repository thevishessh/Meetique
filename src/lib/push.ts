import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { prisma } from "./db";
import { isAllowedPushEndpoint } from "./push-endpoint";

export type PushPayload = { title: string; body: string; url?: string; urgent?: boolean; tag?: string };

let ready: boolean | null = null;
function setup(): boolean {
  if (ready !== null) return ready;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  ready = !!(pub && priv);
  if (ready) setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub!, priv!);
  else console.info("[push] VAPID keys not set — phone alerts disabled");
  return ready;
}

/** Sends a push to every device the user has enabled. Dead subscriptions are removed. */
export async function sendPush(userId: string, payload: PushPayload): Promise<number> {
  if (!setup()) return 0;
  const subs = (await prisma.pushSubscription.findMany({ where: { userId } })).filter((s) => isAllowedPushEndpoint(s.endpoint));
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          TTL: payload.urgent ? 3600 : 24 * 3600,
          urgency: payload.urgent ? "high" : "normal",
        });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        else console.error("[push] send failed", code ?? e);
      }
    }),
  );
  return sent;
}
