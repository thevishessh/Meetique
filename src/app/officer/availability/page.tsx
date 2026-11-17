import { requirePageUser } from "@/lib/auth";
import { loadAvailability } from "@/lib/availability-view";
import { AvailabilityEditor } from "@/components/availability-editor";
import { PageHeader } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OfficerAvailability() {
  const user = await requirePageUser("OFFICER");
  const { officer, hours, settings, blocks } = await loadAvailability(user.officerId!, user.org.timezone);
  return (
    <div>
      <PageHeader
        title="My availability"
        description={<>Working days, hours, breaks, slot length and holidays. <Link href={`/o/${user.org.slug}/${officer.id}`} target="_blank" className="text-ink hover:underline">View my booking page ↗</Link></>}
      />
      <AvailabilityEditor officerId={officer.id} hours={hours} settings={settings} blocks={blocks} timezone={user.org.timezone} />
    </div>
  );
}
