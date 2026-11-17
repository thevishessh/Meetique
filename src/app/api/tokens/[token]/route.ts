import { getUser } from "@/lib/auth";
import { fail, handle, ok } from "@/lib/api";
import { findToken } from "@/lib/booking";
import { parseScan } from "@/lib/tokens";
import { fmtLongDate, fmtRange } from "@/lib/time";
import { INVALID_FOR_ENTRY, STATUS_LABEL } from "@/lib/status";

const mask = (name: string) => name.split(" ").map((p) => (p.length <= 1 ? p : p[0] + "*".repeat(Math.min(p.length - 1, 4)))).join(" ");

/** GET /api/tokens/:token — verify a QR secret or token number.
 *  Staff of the same organization get full details; everyone else gets a masked summary. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const raw = decodeURIComponent((await params).token);
  const user = await getUser();
  const t = await findToken(null, parseScan(raw));
  if (!t) return fail(404, "INVALID_TOKEN", "Token not found");
  const a = t.appointment;
  const tz = a.organization.timezone;
  const isStaff = user?.organizationId === a.organizationId;
  if (!isStaff && !parseScan(raw).qrSecret) return fail(404, "INVALID_TOKEN", "Token not found"); // token numbers are guessable: staff only

  return ok({
    valid: t.isActive && !INVALID_FOR_ENTRY.includes(a.status),
    tokenNumber: t.tokenNumber,
    status: a.status,
    statusLabel: STATUS_LABEL[a.status],
    organization: a.organization.name,
    officer: `${a.officer.user.name} (${a.officer.designation})`,
    department: a.officer.department?.name ?? null,
    date: fmtLongDate(a.startAt, tz),
    time: fmtRange(a.startAt, a.endAt, tz),
    visitor: isStaff ? { name: a.visitor.name, phone: a.visitor.phone, email: a.visitor.email } : { name: mask(a.visitor.name) },
    ...(isStaff ? { appointmentId: a.id, purpose: a.purpose } : {}),
  });
});
