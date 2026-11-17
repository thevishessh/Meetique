import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { qrDataUrl } from "@/lib/tokens";
import { fmtLongDate, fmtRange, fmtDateTime, todayIn, localDateOf } from "@/lib/time";
import { Alert, Card, Logo, StatusBadge } from "@/components/ui";
import ManageActions from "./manage-actions";
import { PUBLIC_BOOKING } from "@/lib/config";
import { INVALID_FOR_ENTRY } from "@/lib/status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Appointment token", robots: { index: false } };

export default async function AppointmentSlip({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ new?: string }> }) {
  const { code } = await params;
  const { new: isNew } = await searchParams;
  const a = await prisma.appointment.findUnique({
    where: { manageCode: code },
    include: {
      visitor: true,
      organization: true,
      tokens: { orderBy: { issuedAt: "desc" }, take: 1 },
      officer: { include: { user: { select: { name: true } }, department: { select: { name: true } } } },
      requestedBy: { select: { name: true } },
    },
  });
  if (!a) notFound();
  const tz = a.organization.timezone;
  const token = a.tokens[0];
  const active = token?.isActive && !INVALID_FOR_ENTRY.includes(a.status);
  const qr = active && token ? await qrDataUrl(token.qrSecret) : null;
  const canChange = (a.status === "BOOKED" || a.status === "PENDING") && a.startAt > new Date() && a.kind !== "IMMEDIATE";

  const rows: [string, string][] = [
    ...(a.kind === "IMMEDIATE" ? ([["Type", `Immediate meeting — called by ${a.requestedBy?.name ?? "officer"}`]] as [string, string][]) : []),
    [PUBLIC_BOOKING ? "Visitor" : "Attendee", a.visitor.name + (a.visitorCategory ? ` (${a.visitorCategory})` : "")],
    ...(a.referenceNo ? ([[a.organization.referenceLabel ?? "Reference", a.referenceNo]] as [string, string][]) : []),
    ["Organization", a.organization.name],
    ...(a.officer.department ? ([["Department", a.officer.department.name]] as [string, string][]) : []),
    ["Officer", `${a.officer.user.name}, ${a.officer.designation}`],
    ...(a.officer.location ? ([["Location", a.officer.location]] as [string, string][]) : []),
    ["Date", fmtLongDate(a.startAt, tz)],
    ["Time", fmtRange(a.startAt, a.endAt, tz)],
    ...(a.purpose ? ([["Purpose", a.purpose]] as [string, string][]) : []),
  ];

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="no-print mb-6 flex items-center justify-between">
          <Link href={`/o/${a.organization.slug}`} className="text-sm text-slate-500 hover:text-slate-800">← {a.organization.name}</Link>
          <Logo className="text-sm [&>span:first-child]:h-6 [&>span:first-child]:w-6" />
        </div>

        {isNew && active && (
          <div className="no-print mb-4"><Alert tone="green"><b>Booking confirmed!</b> Save or print this page — show the QR code at reception on the day of your visit.</Alert></div>
        )}

        <Card className="print-card overflow-hidden">
          <div className={active ? "bg-brand-600 px-6 py-5 text-white" : "bg-slate-700 px-6 py-5 text-white"}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium opacity-90">Appointment {active ? "Confirmation" : "Record"}</span>
              <StatusBadge status={a.status} />
            </div>
            <div className="mt-3 font-mono text-3xl font-bold tracking-wider">{token?.tokenNumber ?? "—"}</div>
            <div className="text-sm opacity-80">Unique Appointment Token</div>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto]">
            <dl className="space-y-2.5 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-2">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-medium text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col items-center">
              {qr ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt={`QR code for token ${token?.tokenNumber}`} className="h-40 w-40 rounded-lg ring-1 ring-slate-200" />
                  <span className="mt-2 text-xs font-medium text-emerald-700">✓ Valid Appointment</span>
                </>
              ) : (
                <div className="grid h-40 w-40 place-items-center rounded-lg bg-slate-100 p-3 text-center text-xs text-slate-500">{a.status === "PENDING" ? "QR appears here once the officer approves" : "Token no longer valid"}</div>
              )}
            </div>
          </div>

          {a.status === "BOOKED" && localDateOf(a.startAt, tz) === todayIn(tz) && (
            <div className="border-t border-slate-100 px-6 py-3 text-sm text-brand-700">Your appointment is today. Please arrive 10 minutes early.</div>
          )}
          {a.status === "CANCELLED" && a.cancelledAt && (
            <div className="border-t border-slate-100 px-6 py-3 text-sm text-rose-700">Cancelled on {fmtDateTime(a.cancelledAt, tz)}. This slot has been released.</div>
          )}
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 text-xs text-slate-500">
            The QR code contains only a secure random identifier — no personal information. Booked {fmtDateTime(a.createdAt, tz)}.
          </div>
        </Card>

        <ManageActions id={a.id} code={code} canChange={canChange} officerId={a.officerId} startDate={todayIn(tz)} slug={a.organization.slug} />
      </div>
    </div>
  );
}
