import { requireApiUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { sendPush } from "@/lib/push";

/** Sends a test alert to all of the current user's devices */
export const POST = handle(async () => {
  const user = await requireApiUser();
  const sent = await sendPush(user.id, { title: "Test alert ✓", body: "Phone alerts are working on this device.", url: "/account" });
  return ok({ sent });
});
