import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { requireApiUser } from "@/lib/auth";
import { fail, handle, ok } from "@/lib/api";
import { buildReport, toCsv } from "@/lib/reports";
import { isValidDate, todayIn } from "@/lib/time";

/** GET /api/reports?from=yyyy-MM-dd&to=yyyy-MM-dd&format=json|csv */
export const GET = handle(async (req: NextRequest) => {
  const user = await requireApiUser("ADMIN");
  const sp = req.nextUrl.searchParams;
  const tz = user.org.timezone;
  const to = sp.get("to") || todayIn(tz);
  const from = sp.get("from") || DateTime.fromISO(to).minus({ days: 29 }).toFormat("yyyy-MM-dd");
  if (!isValidDate(from) || !isValidDate(to) || from > to) return fail(422, "VALIDATION", "Invalid date range");
  const report = await buildReport(user.organizationId, tz, from, to);
  if (sp.get("format") === "csv") {
    return new Response(toCsv(report.rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="appointments_${from}_to_${to}.csv"`,
      },
    });
  }
  return ok(report);
});
