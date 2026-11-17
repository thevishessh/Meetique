import { canUseReception, receptionScope, requireApiUser } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { checkInSchema } from "@/lib/validation";
import { changeStatus, findToken } from "@/lib/booking";
import { parseScan } from "@/lib/tokens";
import { localDateOf, todayIn, fmtRange } from "@/lib/time";
import { STATUS_LABEL } from "@/lib/status";

/** POST /api/check-in  body: { scan } — scanned QR URL, QR secret or token number */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!canUseReception(user) && user.role !== "OFFICER") return fail(403, "FORBIDDEN", "You do not have access to the reception desk");
  const { scan } = checkInSchema.parse(await readJson(req));
  const t = await findToken(user.organizationId, parseScan(scan));
  if (!t) return fail(404, "INVALID_TOKEN", "Invalid token — not found for this organization");
  const a = t.appointment;
  const tz = a.organization.timezone;
  const info = {
    appointmentId: a.id,
    tokenNumber: t.tokenNumber,
    visitor: a.visitor.name,
    phone: a.visitor.phone,
    officer: a.officer.user.name,
    time: fmtRange(a.startAt, a.endAt, tz),
  };
  if (!t.isActive || a.status === "CANCELLED" || a.status === "DECLINED") return fail(409, "CANCELLED", `Token ${t.tokenNumber} is cancelled / no longer valid`);
  if (a.status === "PENDING") return fail(409, "NOT_APPROVED", `Token ${t.tokenNumber} has not been approved by the officer yet`);
  if (a.status !== "BOOKED") return ok({ ...info, status: a.status, message: `Already ${STATUS_LABEL[a.status]}` });
  if (localDateOf(a.startAt, tz) !== todayIn(tz)) {
    return fail(409, "WRONG_DAY", `Token ${t.tokenNumber} is for ${localDateOf(a.startAt, tz)}, not today`);
  }
  if (user.role === "OFFICER" && a.officerId !== user.officerId) return fail(403, "FORBIDDEN", "This visitor is for another officer");
  const scope = receptionScope(user);
  if (user.role === "STAFF" && a.officerId !== scope) return fail(403, "FORBIDDEN", `This visitor is for ${a.officer.user.name}, not ${user.pa?.officerName}`);
  const updated = await changeStatus(a.id, "CHECKED_IN", user, "QR check-in");
  return ok({ ...info, status: updated.status, message: "Checked in" });
});
