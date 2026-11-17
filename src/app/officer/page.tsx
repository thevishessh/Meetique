import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { dayBounds, fmtLongDate, fmtRange, todayIn } from "@/lib/time";
import { nextActions } from "@/lib/status";
import { apptInclude, ResponseBadge, type ApptRow } from "@/components/appointment-table";
import { StatusActions } from "@/components/status-actions";
import { AutoRefresh } from "@/components/nav-client";
import { Badge, Card, CardHeader, Empty, PageHeader, Stat, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function OfficerQueue() {
  const user = await requirePageUser("OFFICER");
  const tz = user.org.timezone;
  const { start, end } = dayBounds(todayIn(tz), tz);
  const rows: ApptRow[] = await prisma.appointment.findMany({
    where: { officerId: user.officerId!, startAt: { gte: start, lt: end } },
    include: apptInclude,
    orderBy: { startAt: "asc" },
  });
  const current = rows.filter((r) => r.status === "IN_PROGRESS");
  const waiting = rows.filter((r) => r.status === "CHECKED_IN" || r.status === "WAITING");
  const upcoming = rows.filter((r) => r.status === "BOOKED");
  const done = rows.filter((r) => ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(r.status));

  const Item = ({ r, big }: { r: ApptRow; big?: boolean }) => (
    <li className={`flex flex-wrap items-start justify-between gap-3 px-5 ${big ? "py-5" : "py-3"}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-semibold text-slate-900 ${big ? "text-lg" : ""}`}>{r.visitor.name}</span>
          {r.tokens[0] && <Link href={`/t/${r.tokens[0].qrSecret}`} className="font-mono text-xs text-brand-700 hover:underline">{r.tokens[0].tokenNumber}</Link>}
          {r.source === "WALK_IN" && <Badge tone="amber">Walk-in</Badge>}
          {r.kind === "IMMEDIATE" && <Badge tone="rose">Immediate</Badge>}
          <ResponseBadge r={r} />
        </div>
        <div className="text-sm text-slate-500">{fmtRange(r.startAt, r.endAt, tz)}{r.visitor.user?.jobTitle ? ` · ${r.visitor.user.jobTitle}` : ""}{r.visitor.phone ? ` · ${r.visitor.phone}` : ""}{r.visitorCategory ? ` · ${r.visitorCategory}` : ""}{r.referenceNo ? ` · ${r.referenceNo}` : ""}</div>
        {r.purpose && <div className="mt-1 text-sm text-slate-700">“{r.purpose}”</div>}
      </div>
      <div className="flex flex-col items-end gap-2">
        <StatusBadge status={r.status} />
        <StatusActions id={r.id} actions={nextActions(r.status, "OFFICER")} size={big ? "md" : "sm"} />
      </div>
    </li>
  );

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      <PageHeader title="My queue" description={`${fmtLongDate(new Date(), tz)} · updates automatically`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Today" value={rows.length} />
        <Stat label="Waiting" value={waiting.length} tone="text-amber-600" />
        <Stat label="Upcoming" value={upcoming.length} tone="text-sky-600" />
        <Stat label="Done" value={done.filter((r) => r.status === "COMPLETED").length} tone="text-emerald-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader title="Now in meeting" />
          {current.length ? <ul className="divide-y divide-slate-100">{current.map((r) => <Item key={r.id} r={r} big />)}</ul> : <div className="p-5"><Empty title="No meeting in progress">Start a meeting from the waiting list below.</Empty></div>}
        </Card>
        <Card>
          <CardHeader title="Waiting" description="Checked in at reception" />
          {waiting.length ? <ul className="divide-y divide-slate-100">{waiting.map((r) => <Item key={r.id} r={r} />)}</ul> : <div className="p-5"><Empty title="Nobody waiting" /></div>}
        </Card>
        <Card>
          <CardHeader title="Upcoming today" description="Not yet arrived" />
          {upcoming.length ? <ul className="divide-y divide-slate-100">{upcoming.map((r) => <Item key={r.id} r={r} />)}</ul> : <div className="p-5"><Empty title="No more bookings today" /></div>}
        </Card>
        {done.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader title="Finished" />
            <ul className="divide-y divide-slate-100">{done.map((r) => <Item key={r.id} r={r} />)}</ul>
          </Card>
        )}
      </div>
    </div>
  );
}
