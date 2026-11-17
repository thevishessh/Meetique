import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { dayBounds, isValidDate, todayIn, fmtLongDate } from "@/lib/time";
import { AppointmentTable, apptInclude } from "@/components/appointment-table";
import { DateNav } from "@/components/date-nav";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function OfficerAppointments({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requirePageUser("OFFICER");
  const sp = await searchParams;
  const tz = user.org.timezone;
  const today = todayIn(tz);
  const date = sp.date && isValidDate(sp.date) ? sp.date : today;
  const { start, end } = dayBounds(date, tz);
  const rows = await prisma.appointment.findMany({ where: { officerId: user.officerId!, startAt: { gte: start, lt: end } }, include: apptInclude, orderBy: { startAt: "asc" } });
  return (
    <div>
      <PageHeader title="My appointments" description={fmtLongDate(start, tz)} action={<DateNav date={date} today={today} />} />
      <Card><AppointmentTable rows={rows} tz={tz} role="OFFICER" officerId={user.officerId} showOfficer={false} empty="No appointments on this day" /></Card>
    </div>
  );
}
