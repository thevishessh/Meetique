import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { loadAvailability } from "@/lib/availability-view";
import { AvailabilityEditor } from "@/components/availability-editor";
import { PageHeader } from "@/components/ui";
import { OfficerProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function OfficerDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser("ADMIN");
  const { id } = await params;
  const exists = await prisma.officerProfile.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!exists) notFound();
  const tz = user.org.timezone;
  const [{ officer, hours, settings, blocks }, departments] = await Promise.all([
    loadAvailability(id, tz),
    prisma.department.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <Link href="/admin/officers" className="text-sm text-slate-500 hover:text-slate-800">← Officers</Link>
      <PageHeader
        title={officer.user.name}
        description={<>{officer.designation} · <Link className="text-brand-600 hover:underline" href={`/o/${user.org.slug}/${officer.id}`} target="_blank">public booking page ↗</Link></>}
      />
      <OfficerProfileForm
        officer={{
          id: officer.id,
          userId: officer.userId,
          name: officer.user.name,
          email: officer.user.email,
          employeeId: officer.user.employeeId,
          phone: officer.user.phone,
          designation: officer.designation,
          departmentId: officer.departmentId,
          location: officer.location,
          bio: officer.bio,
          isActive: officer.user.isActive,
          canSummon: officer.canSummon,
        }}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      />
      <AvailabilityEditor officerId={officer.id} hours={hours} settings={settings} blocks={blocks} timezone={tz} />
    </div>
  );
}
