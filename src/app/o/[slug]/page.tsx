import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, Empty } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { PUBLIC_BOOKING } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function OrgPortal({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ d?: string }> }) {
  const { slug } = await params;
  const { d } = await searchParams;
  const org = await prisma.organization.findUnique({
    where: { slug },
    include: {
      departments: { orderBy: { name: "asc" } },
    },
  });
  if (!org) notFound();
  const me = await getUser();
  const officers = await prisma.officerProfile.findMany({
    where: { organizationId: org.id, isBookable: true, user: { isActive: true }, ...(me ? { NOT: { userId: me.id } } : {}), ...(d ? { departmentId: d } : {}) },
    include: { user: { select: { name: true } }, department: { select: { name: true } } },
    orderBy: [{ department: { name: "asc" } }, { user: { name: "asc" } }],
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">{PUBLIC_BOOKING ? "Book an appointment" : "Book a meeting with an officer"}</h1>
      <p className="mt-1 text-sm text-muted">Choose a department and officer, pick a time, and get your QR token instantly.</p>
      <ol className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
        {[
          ["1", "Choose officer & slot", "Only free time slots are shown."],
          ["2", "Get your QR token", "Save or print the confirmation."],
          ["3", "Show QR at reception", "You'll be checked in and called in turn."],
        ].map(([n, t, d]) => (
          <li key={n} className="flex gap-3 rounded-xl bg-paper p-4 ring-1 ring-rule">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-paper">{n}</span>
            <span><span className="block font-medium text-ink">{t}</span><span className="text-muted">{d}</span></span>
          </li>
        ))}
      </ol>

      {org.departments.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/o/${slug}`} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset ${!d ? "bg-ink text-paper ring-ink" : "bg-paper text-ink-2 ring-rule hover:ring-ink"}`}>All departments</Link>
          {org.departments.map((dep) => (
            <Link key={dep.id} href={`/o/${slug}?d=${dep.id}`} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset ${d === dep.id ? "bg-ink text-paper ring-ink" : "bg-paper text-ink-2 ring-rule hover:ring-ink"}`}>
              {dep.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {officers.map((o) => (
          <Link key={o.id} href={`/o/${slug}/${o.id}`} className="group">
            <Card className="flex items-center gap-4 p-5 transition group-hover:ring-ink">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent-soft text-base font-semibold text-ink">
                {o.user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-ink">{o.user.name}</div>
                <div className="truncate text-sm text-ink-2">{o.designation}</div>
                <div className="mt-1 text-xs text-muted">{o.department?.name ?? "General"}; {o.slotDurationMin === o.maxDurationMin ? `${o.slotDurationMin} min` : `${o.slotDurationMin} to ${o.maxDurationMin} min`} meetings{o.requiresApproval ? "; needs approval" : ""}</div>
              </div>
              <span className="text-sm font-semibold text-ink underline decoration-rule underline-offset-4 group-hover:decoration-accent">Book</span>
            </Card>
          </Link>
        ))}
      </div>
      {officers.length === 0 && <div className="mt-6"><Empty title="No officers are accepting bookings right now.">Please check back later.</Empty></div>}
    </div>
  );
}
