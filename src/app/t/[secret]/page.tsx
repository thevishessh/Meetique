import Link from "next/link";
import { getUser, homeFor } from "@/lib/auth";
import { findToken } from "@/lib/booking";
import { fmtLongDate, fmtRange, localDateOf, todayIn } from "@/lib/time";
import { Card, Logo, StatusBadge } from "@/components/ui";
import { StatusActions } from "@/components/status-actions";
import { INVALID_FOR_ENTRY, nextActions } from "@/lib/status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify token", robots: { index: false } };

const mask = (n: string) => n.split(" ").map((p) => (p.length <= 1 ? p : p[0] + "•".repeat(Math.min(p.length - 1, 4)))).join(" ");

/** Target of the QR code. Public: validity + masked name. Same-org staff: full details + actions. */
export default async function VerifyToken({ params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const [t, user] = await Promise.all([findToken(null, { qrSecret: secret }), getUser()]);

  if (!t) {
    return (
      <Shell>
        <Card className="p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-paper text-2xl text-error">✕</div>
          <h1 className="mt-4 text-xl font-semibold">Invalid token</h1>
          <p className="mt-1 text-sm text-muted">This QR code does not match any appointment.</p>
        </Card>
      </Shell>
    );
  }

  const a = t.appointment;
  const tz = a.organization.timezone;
  const staff = user && user.organizationId === a.organizationId ? user : null;
  const valid = t.isActive && !INVALID_FOR_ENTRY.includes(a.status);
  const isToday = localDateOf(a.startAt, tz) === todayIn(tz);
  const isPA = !!staff?.pa && staff.pa.officerId === a.officerId;
  const actions = !staff
    ? []
    : isPA
      ? nextActions(a.status, "RECEPTIONIST")
      : staff.role === "STAFF" || (staff.role === "OFFICER" && staff.officerId !== a.officerId)
        ? []
        : nextActions(a.status, staff.role);

  return (
    <Shell staffHome={staff ? homeFor(staff.role) : undefined}>
      <Card className="overflow-hidden">
        <div className={`px-6 py-5 text-paper ${valid ? "bg-accent" : "bg-ink"}`}>
          <div className="text-sm font-medium opacity-90">{valid ? "✓ Valid Appointment" : "✕ Not valid"}</div>
          <div className="mt-1 token-no text-2xl font-bold tracking-wider">{t.tokenNumber}</div>
          {valid && !isToday && <div className="mt-1 text-sm">Note: this appointment is not for today.</div>}
        </div>
        <dl className="space-y-2.5 p-6 text-sm">
          {(
            [
              ["Status", <StatusBadge key="s" status={a.status} />],
              ["Visitor", staff ? a.visitor.name : mask(a.visitor.name)],
              ...(staff ? [["Mobile", a.visitor.phone]] : []),
              ...(staff && a.visitorCategory ? [["Visitor type", a.visitorCategory]] : []),
              ...(staff && a.referenceNo ? [["Reference", a.referenceNo]] : []),
              ["Organization", a.organization.name],
              ["Officer", `${a.officer.user.name} (${a.officer.designation})`],
              ["Date", fmtLongDate(a.startAt, tz)],
              ["Time", fmtRange(a.startAt, a.endAt, tz)],
              ...(staff && a.purpose ? [["Purpose", a.purpose]] : []),
            ] as [string, React.ReactNode][]
          ).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-2">
              <dt className="text-muted">{k}</dt>
              <dd className="font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {actions.length > 0 && (
          <div className="border-t border-rule px-6 py-4">
            <StatusActions id={a.id} actions={actions} size="md" />
          </div>
        )}
        {!staff && (
          <div className="border-t border-rule bg-paper-2 px-6 py-3 text-xs text-muted">
            Reception staff: <Link className="text-ink hover:underline" href="/login">sign in</Link> to check this visitor in.
          </div>
        )}
      </Card>
    </Shell>
  );
}

function Shell({ children, staffHome }: { children: React.ReactNode; staffHome?: string }) {
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Logo className="text-sm" />
          {staffHome && <Link href={staffHome} className="link text-sm">Open my desk</Link>}
        </div>
        {children}
      </div>
    </div>
  );
}
