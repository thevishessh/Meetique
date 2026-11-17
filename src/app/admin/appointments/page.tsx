import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { dayBounds, isValidDate, todayIn, fmtLongDate } from "@/lib/time";
import { STATUS_LABEL } from "@/lib/status";
import { AppointmentTable, apptInclude } from "@/components/appointment-table";
import { DateNav, FilterSelect } from "@/components/date-nav";
import { Card, PageHeader } from "@/components/ui";
import type { AppointmentStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

export default async function AdminAppointments({ searchParams }: { searchParams: Promise<{ date?: string; officer?: string; status?: string }> }) {
  const user = await requirePageUser("ADMIN");
  const sp = await searchParams;
  const tz = user.org.timezone;
  const today = todayIn(tz);
  const date = sp.date && isValidDate(sp.date) ? sp.date : today;
  const { start, end } = dayBounds(date, tz);
  const status = sp.status && sp.status in STATUS_LABEL ? (sp.status as AppointmentStatus) : undefined;

  const [rows, officers] = await Promise.all([
    prisma.appointment.findMany({
      where: { organizationId: user.organizationId, startAt: { gte: start, lt: end }, officerId: sp.officer || undefined, status },
      include: apptInclude,
      orderBy: [{ startAt: "asc" }],
    }),
    prisma.officerProfile.findMany({ where: { organizationId: user.organizationId }, include: { user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }),
  ]);

  return (
    <div>
      <PageHeader title="Appointments" description={fmtLongDate(start, tz)} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <DateNav date={date} today={today} />
        <FilterSelect name="officer" value={sp.officer ?? ""} all="All officers" options={officers.map((o) => ({ value: o.id, label: o.user.name }))} />
        <FilterSelect name="status" value={status ?? ""} all="All statuses" options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
        <span className="text-sm text-slate-500">{rows.length} result{rows.length === 1 ? "" : "s"}</span>
      </div>
      <Card><AppointmentTable rows={rows} tz={tz} role="ADMIN" empty="No appointments for this day / filter" /></Card>
    </div>
  );
}
