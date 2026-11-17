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
      <h1 className="text-2xl font-semibold tracking-tight">{PUBLIC_BOOKING ? "Book an appointment" : "Book a meeting with an officer"}</h1>
      <p className="mt-1 text-sm text-slate-500">Choose a department and officer, pick a time, and get your QR token instantly.</p>
      <ol className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
        {[
          ["1", "Choose officer & slot", "Only free time slots are shown."],
          ["2", "Get your QR token", "Save or print the confirmation."],
          ["3", "Show QR at reception", "You'll be checked in and called in turn."],
        ].map(([n, t, d]) => (
          <li key={n} className="flex gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white">{n}</span>
            <span><span className="block font-medium text-slate-900">{t}</span><span className="text-slate-500">{d}</span></span>
          </li>
        ))}
      </ol>

      {org.departments.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/o/${slug}`} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset ${!d ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-300 hover:ring-brand-300"}`}>All departments</Link>
          {org.departments.map((dep) => (
            <Link key={dep.id} href={`/o/${slug}?d=${dep.id}`} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset ${d === dep.id ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-300 hover:ring-brand-300"}`}>
              {dep.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {officers.map((o) => (
          <Link key={o.id} href={`/o/${slug}/${o.id}`} className="group">
            <Card className="flex items-center gap-4 p-5 transition group-hover:ring-brand-300">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-50 text-base font-semibold text-brand-700">
                {o.user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-slate-900">{o.user.name}</div>
                <div className="truncate text-sm text-slate-600">{o.designation}</div>
                <div className="mt-1 text-xs text-slate-500">{o.department?.name ?? "General"} · {o.slotDurationMin} min meetings</div>
              </div>
              <span className="text-sm font-medium text-brand-600 group-hover:translate-x-0.5 transition">Book →</span>
            </Card>
          </Link>
        ))}
      </div>
      {officers.length === 0 && <div className="mt-6"><Empty title="No officers are accepting bookings right now.">Please check back later.</Empty></div>}
    </div>
  );
}
