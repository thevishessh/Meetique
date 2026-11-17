import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { TIMEZONES } from "@/lib/config";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requirePageUser("ADMIN");
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
  return (
    <div className="space-y-6">
      <PageHeader title="Organization settings" />
      <Card>
        <CardHeader title="Details" description={`Booking URL /o/${org.slug} · Token prefix ${org.shortCode} (fixed once tokens are issued)`} />
        <SettingsForm org={{ name: org.name, timezone: org.timezone, email: org.email, phone: org.phone, address: org.address, visitorCategories: org.visitorCategories, referenceLabel: org.referenceLabel }} timezones={TIMEZONES.includes(org.timezone) ? TIMEZONES : [org.timezone, ...TIMEZONES]} />
      </Card>
    </div>
  );
}
