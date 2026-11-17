import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { dayBounds, fmtDate, fmtLongDate, fmtRange, localDateOf, todayIn } from "@/lib/time";
import { nextActions } from "@/lib/status";
import { apptInclude, ResponseBadge, type ApptRow } from "@/components/appointment-table";
import { StatusActions } from "@/components/status-actions";
import { NotesEditor } from "@/components/notes-editor";
import { AutoRefresh } from "@/components/nav-client";
import { Badge, Card, CardHeader, Empty, PageHeader, Stat, Stats, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

type Row = ApptRow & { notes: string | null };

export default async function OfficerQueue() {
  const user = await requirePageUser("OFFICER");
  const tz = user.org.timezone;
  const today = todayIn(tz);
  const { start, end } = dayBounds(today, tz);
  const [rows, pending]: [Row[], Row[]] = await Promise.all([
    prisma.appointment.findMany({
      where: { officerId: user.officerId!, startAt: { gte: start, lt: end }, status: { not: "PENDING" } },
      include: apptInclude,
      orderBy: { startAt: "asc" },
    }),
    prisma.appointment.findMany({
      where: { officerId: user.officerId!, status: "PENDING", startAt: { gte: new Date() } },
      include: apptInclude,
      orderBy: { startAt: "asc" },
    }),
  ]);
  const current = rows.filter((r) => r.status === "IN_PROGRESS");
  const waiting = rows.filter((r) => r.status === "CHECKED_IN" || r.status === "WAITING");
  const upcoming = rows.filter((r) => r.status === "BOOKED");
  const done = rows.filter((r) => ["COMPLETED", "CANCELLED", "NO_SHOW", "DECLINED"].includes(r.status));

  const Item = ({ r, big, notes, showDate }: { r: Row; big?: boolean; notes?: boolean; showDate?: boolean }) => (
    <li className={`flex flex-wrap items-start justify-between gap-3 px-5 ${big ? "py-5" : "py-3"}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-semibold text-ink ${big ? "text-lg" : ""}`}>{r.visitor.name}</span>
          {r.tokens[0] && <Link href={`/t/${r.tokens[0].qrSecret}`} className="token-no text-xs text-ink hover:underline">{r.tokens[0].tokenNumber}</Link>}
          {r.source === "WALK_IN" && <Badge tone="amber">Walk-in</Badge>}
          {r.kind === "IMMEDIATE" && <Badge tone="rose">Immediate</Badge>}
          <ResponseBadge r={r} />
        </div>
        <div className="text-sm text-muted">
          {showDate && localDateOf(r.startAt, tz) !== today ? `${fmtDate(r.startAt, tz)}, ` : ""}
          {fmtRange(r.startAt, r.endAt, tz)} ({Math.round((r.endAt.getTime() - r.startAt.getTime()) / 60000)} min)
          {r.visitor.user?.jobTitle ? `, ${r.visitor.user.jobTitle}` : ""}
          {r.visitor.user?.employeeId ? `, L Code ${r.visitor.user.employeeId}` : r.referenceNo ? `, L Code ${r.referenceNo}` : ""}
          {r.visitor.phone ? `, ${r.visitor.phone}` : ""}
        </div>
        {r.purpose && <div className="mt-1 text-sm text-ink-2">“{r.purpose}”</div>}
        {r.notes && <div className="mt-1 whitespace-pre-line rounded-md bg-paper-2 px-3 py-2 text-xs text-ink-2"><b>Notes:</b> {r.notes}</div>}
        {notes && <div className="mt-1"><NotesEditor id={r.id} initial={r.notes} /></div>}
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
      <PageHeader title="My queue" description={`${fmtLongDate(new Date(), tz)}. Updates on its own.`} />
      <Stats>
        <Stat label="Today" value={rows.length} />
        <Stat label="Waiting" value={waiting.length} tone="in" />
        <Stat label="Requests to approve" value={pending.length} />
        <Stat label="Done" value={done.filter((r) => r.status === "COMPLETED").length} />
      </Stats>

      {pending.length > 0 && (
        <Card className="ring-ink">
          <CardHeader title="Meeting requests awaiting your approval" description="The slot is held until you approve or decline. The person gets an alert either way." />
          <ul className="divide-y divide-rule">{pending.map((r) => <Item key={r.id} r={r} showDate />)}</ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader title="Now in meeting" />
          {current.length ? <ul className="divide-y divide-rule">{current.map((r) => <Item key={r.id} r={r} big notes />)}</ul> : <Empty title="No meeting in progress">Start a meeting from the waiting list below.</Empty>}
        </Card>
        <Card>
          <CardHeader title="Waiting" description="Checked in / on the way" />
          {waiting.length ? <ul className="divide-y divide-rule">{waiting.map((r) => <Item key={r.id} r={r} />)}</ul> : <Empty title="Nobody waiting" />}
        </Card>
        <Card>
          <CardHeader title="Upcoming today" description="Not yet arrived" />
          {upcoming.length ? <ul className="divide-y divide-rule">{upcoming.map((r) => <Item key={r.id} r={r} />)}</ul> : <Empty title="No more bookings today" />}
        </Card>
        {done.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader title="Finished" description="Add notes or decisions for completed meetings" />
            <ul className="divide-y divide-rule">{done.map((r) => <Item key={r.id} r={r} notes={r.status === "COMPLETED"} />)}</ul>
          </Card>
        )}
      </div>
    </div>
  );
}
