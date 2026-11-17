import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { todayIn } from "@/lib/time";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { HolidaysManager } from "./holidays-manager";

export const dynamic = "force-dynamic";

export default async function HolidaysPage() {
  const user = await requirePageUser("ADMIN");
  const today = todayIn(user.org.timezone);
  const rows = await prisma.orgHoliday.findMany({ where: { organizationId: user.organizationId, date: { gte: today } }, orderBy: { date: "asc" } });
  return (
    <div className="space-y-6">
      <PageHeader title="Holidays" description="University-wide holidays close online booking for every officer. For one officer's leave, use that officer's availability page." />
      <Card>
        <CardHeader title="Upcoming holidays" />
        <HolidaysManager rows={rows.map((h) => ({ id: h.id, name: h.name, label: DateTime.fromISO(h.date).toFormat("ccc, d LLL yyyy") }))} />
      </Card>
    </div>
  );
}
