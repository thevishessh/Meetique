import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getOpenDays } from "@/lib/slots";
import { todayIn } from "@/lib/time";
import BookingWizard from "./booking-wizard";
import { getUser } from "@/lib/auth";
import { PUBLIC_BOOKING } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function OfficerBooking({ params }: { params: Promise<{ slug: string; officerId: string }> }) {
  const { slug, officerId } = await params;
  const officer = await prisma.officerProfile.findFirst({
    where: { id: officerId, isBookable: true, user: { isActive: true, organization: { slug } } },
    include: { department: { select: { name: true } }, user: { select: { name: true, organization: { select: { timezone: true, visitorCategories: true, referenceLabel: true } } } } },
  });
  if (!officer) notFound();
  const tz = officer.user.organization.timezone;
  const me = PUBLIC_BOOKING ? null : await getUser();
  const start = todayIn(tz);
  const days = await getOpenDays(officer.id, start, Math.min(14, officer.advanceBookingDays + 1));

  return (
    <div>
      <Link href={`/o/${slug}`} className="link text-sm">All officers</Link>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-lg font-semibold text-ink">
          {officer.user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{officer.user.name}</h1>
          <p className="text-sm text-ink-2">
            {officer.designation}
            {officer.department ? `, ${officer.department.name}` : ""}
            {officer.location ? `, ${officer.location}` : ""}
          </p>
        </div>
      </div>
      {officer.bio && <p className="mt-3 max-w-2xl text-sm text-ink-2">{officer.bio}</p>}
      <BookingWizard officerId={officer.id} startDate={start} days={days} duration={officer.slotDurationMin} fields={{ visitorCategories: officer.user.organization.visitorCategories, referenceLabel: officer.user.organization.referenceLabel }} identity={me ? { name: me.name, email: me.email, lCode: me.employeeId } : null} requiresApproval={officer.requiresApproval} />
    </div>
  );
}
