import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { APP_URL } from "@/lib/config";
import { dayBounds, todayIn, fmtLongDate } from "@/lib/time";
import { ACTIVE_STATUSES } from "@/lib/status";
import { AppointmentTable, apptInclude } from "@/components/appointment-table";
import { Card, CardHeader, PageHeader, Stat, Alert, ButtonLink } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { AutoRefresh } from "@/components/nav-client";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const user = await requirePageUser("ADMIN");
  const tz = user.org.timezone;
  const today = todayIn(tz);
  const { start, end } = dayBounds(today, tz);
  const orgId = user.organizationId;

  const [todays, upcomingCount, officerCount, deptCount] = await Promise.all([
    prisma.appointment.findMany({ where: { organizationId: orgId, startAt: { gte: start, lt: end } }, include: apptInclude, orderBy: { startAt: "asc" } }),
    prisma.appointment.count({ where: { organizationId: orgId, startAt: { gte: end }, status: "BOOKED" } }),
    prisma.officerProfile.count({ where: { organizationId: orgId, user: { isActive: true } } }),
    prisma.department.count({ where: { organizationId: orgId } }),
  ]);
  const count = (s: string[]) => todays.filter((a) => s.includes(a.status)).length;
  const bookingUrl = `${APP_URL}/o/${user.org.slug}`;

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={30} />
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description={fmtLongDate(new Date(), tz)} action={<ButtonLink href="/admin/reports" variant="secondary">View reports</ButtonLink>} />

      {officerCount === 0 && (
        <Alert tone="brand">
          <b>Get started:</b> <Link className="underline" href="/admin/departments">add departments</Link>, then <Link className="underline" href="/admin/officers">add officers</Link> — visitors can book as soon as an officer has working hours.
        </Alert>
      )}

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-500">Public booking link</div>
          <a href={bookingUrl} target="_blank" className="block truncate font-mono text-sm text-brand-700 hover:underline">{bookingUrl}</a>
        </div>
        <CopyButton text={bookingUrl} />
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Today" value={todays.length} hint="appointments" />
        <Stat label="Waiting now" value={count(["CHECKED_IN", "WAITING"])} tone="text-amber-600" />
        <Stat label="In progress" value={count(["IN_PROGRESS"])} tone="text-emerald-600" />
        <Stat label="Completed" value={count(["COMPLETED"])} />
        <Stat label="Upcoming" value={upcomingCount} hint={`${officerCount} officers · ${deptCount} departments`} />
      </div>

      <Card>
        <CardHeader title="Today's appointments" description={`${count(ACTIVE_STATUSES)} active · ${count(["CANCELLED"])} cancelled · ${count(["NO_SHOW"])} no-show`} action={<ButtonLink href="/reception" size="sm" variant="secondary">Open reception desk</ButtonLink>} />
        <AppointmentTable rows={todays} tz={tz} role="ADMIN" empty="No appointments today" />
      </Card>
    </div>
  );
}
