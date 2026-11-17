import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { fmtDate, fmtRange, localDateOf, todayIn } from "@/lib/time";
import { ACTIVE_STATUSES } from "@/lib/status";
import { Badge, ButtonLink, Card, CardHeader, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { StatusActions } from "@/components/status-actions";
import { AutoRefresh } from "@/components/nav-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "My meetings" };

/** Meetings where the signed-in person is the attendee (booked by them, or called in by an officer) */
export default async function MyMeetings() {
  const user = await requirePageUser();
  const tz = user.org.timezone;
  const include = {
    officer: { include: { user: { select: { name: true } }, department: { select: { name: true } } } },
    tokens: { orderBy: { issuedAt: "desc" as const }, take: 1 },
    requestedBy: { select: { name: true } },
  };
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    prisma.appointment.findMany({ where: { visitor: { userId: user.id }, status: { in: ACTIVE_STATUSES }, endAt: { gt: new Date(now.getTime() - 3600_000) } }, include, orderBy: { startAt: "asc" } }),
    prisma.appointment.findMany({ where: { visitor: { userId: user.id }, OR: [{ status: { notIn: ACTIVE_STATUSES } }, { endAt: { lte: new Date(now.getTime() - 3600_000) } }] }, include, orderBy: { startAt: "desc" }, take: 20 }),
  ]);

  const Row = ({ a, showActions }: { a: (typeof upcoming)[number]; showActions?: boolean }) => (
    <li className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-900">{a.officer.user.name}</span>
          <span className="text-sm text-slate-500">{a.officer.designation}{a.officer.department ? ` · ${a.officer.department.name}` : ""}</span>
          {a.kind === "IMMEDIATE" && <Badge tone="rose">Immediate · called by {a.requestedBy?.name ?? "officer"}</Badge>}
        </div>
        <div className="mt-0.5 text-sm text-slate-700">
          {localDateOf(a.startAt, tz) === todayIn(tz) ? "Today" : fmtDate(a.startAt, tz)}, {fmtRange(a.startAt, a.endAt, tz)}
          {a.officer.location ? ` · ${a.officer.location}` : ""}
        </div>
        {a.purpose && <div className="mt-1 text-sm text-slate-600">“{a.purpose}”</div>}
        {a.tokens[0] && <Link href={`/a/${a.manageCode}`} className="mt-1 inline-block font-mono text-xs text-brand-700 hover:underline">{a.tokens[0].tokenNumber} · view QR slip</Link>}
      </div>
      <div className="flex flex-col items-end gap-2">
        <StatusBadge status={a.status} />
        {showActions && a.status === "BOOKED" && a.kind !== "IMMEDIATE" && a.startAt > now && <StatusActions id={a.id} actions={["CANCELLED"]} />}
      </div>
    </li>
  );

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={20} />
      <PageHeader title="My meetings" description="Meetings you booked, and meetings officers have called you to." action={<ButtonLink href={`/o/${user.org.slug}`}>Book a meeting</ButtonLink>} />
      <Card>
        <CardHeader title="Upcoming" />
        {upcoming.length ? <ul className="divide-y divide-slate-100">{upcoming.map((a) => <Row key={a.id} a={a} showActions />)}</ul> : <div className="p-5"><Empty title="No upcoming meetings">Use “Book a meeting” to request time with an officer.</Empty></div>}
      </Card>
      {past.length > 0 && (
        <Card>
          <CardHeader title="Past & cancelled" />
          <ul className="divide-y divide-slate-100">{past.map((a) => <Row key={a.id} a={a} />)}</ul>
        </Card>
      )}
    </div>
  );
}
