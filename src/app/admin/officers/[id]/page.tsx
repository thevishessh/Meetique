import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { loadAvailability } from "@/lib/availability-view";
import { AvailabilityEditor } from "@/components/availability-editor";
import { PageHeader } from "@/components/ui";
import { OfficerProfileForm } from "./profile-form";
import { PaManager } from "./pa-manager";

export const dynamic = "force-dynamic";

export default async function OfficerDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser("ADMIN");
  const { id } = await params;
  const exists = await prisma.officerProfile.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!exists) notFound();
  const tz = user.org.timezone;
  const [{ officer, hours, settings, blocks }, departments, staff] = await Promise.all([
    loadAvailability(id, tz),
    prisma.department.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { organizationId: user.organizationId, role: "STAFF", isActive: true },
      select: { id: true, name: true, employeeId: true, jobTitle: true, paOfficerId: true, paFor: { select: { user: { select: { name: true } } } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <div className="space-y-6">
      <Link href="/admin/officers" className="link text-sm">All officers</Link>
      <PageHeader
        title={officer.user.name}
        description={<>{officer.designation}. <Link className="link" href={`/o/${user.org.slug}/${officer.id}`} target="_blank">Open the booking page</Link></>}
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
      <PaManager
        officerId={officer.id}
        officerName={officer.user.name}
        current={staff.filter((s) => s.paOfficerId === officer.id).map((s) => ({ id: s.id, name: s.name, detail: [s.jobTitle, s.employeeId && `L Code ${s.employeeId}`].filter(Boolean).join(" · ") }))}
        candidates={staff.filter((s) => s.paOfficerId !== officer.id).map((s) => ({ id: s.id, name: s.name, detail: [s.employeeId, s.paFor ? `now PA to ${s.paFor.user.name}` : null].filter(Boolean).join(" · ") }))}
      />
      <AvailabilityEditor officerId={officer.id} hours={hours} settings={settings} blocks={blocks} timezone={tz} />
    </div>
  );
}
