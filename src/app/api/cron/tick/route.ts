import { fail, handle, ok } from "@/lib/api";
import { runJobs } from "@/lib/jobs";
import { safeEqual } from "@/lib/safe-equal";

/**
 * POST /api/cron/tick  (header: x-cron-secret: <CRON_SECRET>)
 * For hosting where the built-in timer can't run (e.g. serverless): call this every minute from a cron service.
 */
export const POST = handle(async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("x-cron-secret"), secret)) return fail(401, "UNAUTHORIZED", "Invalid cron secret");
  return ok(await runJobs());
});
