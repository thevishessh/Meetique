import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Empty } from "@/components/ui";
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
    where: { organizationId: org.id, isBookable: true, user: { isActive: true }, ...(me ? { NOT: { userId: me.id } } : {}) },
    include: { user: { select: { name: true } }, department: { select: { id: true, name: true } } },
    orderBy: [{ department: { name: "asc" } }, { user: { name: "asc" } }],
  });
  // Only departments that have someone to book (staff-only departments are left out)
  const deps = org.departments.filter((dep) => officers.some((o) => o.departmentId === dep.id));
  const shown = d ? officers.filter((o) => o.departmentId === d) : officers;
  const chip = (active: boolean) => (active ? "btn btn--sm btn--primary" : "btn btn--sm");

  return (
    <div className="space-y-10">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <h1 className="text-display text-ink">{PUBLIC_BOOKING ? "Book an appointment" : "Book a meeting with an officer"}</h1>
          <p className="mt-3 text-md text-ink-2">Pick an office, choose a free time and get your QR token straight away.</p>
        </div>
        <ol className="grid grid-cols-3 border-t border-ink text-sm lg:col-span-5">
          {[
            ["1", "Choose a time"],
            ["2", "Get your QR token"],
            ["3", "Show it at the desk"],
          ].map(([n, t]) => (
            <li key={n} className="border-r border-rule pt-3 pr-3 last:border-r-0 [&:not(:first-child)]:pl-3">
              <span className="num block font-display text-2xl font-bold text-ink">{n}</span>
              <span className="text-ink-2">{t}</span>
            </li>
          ))}
        </ol>
      </div>

      {deps.length > 1 && (
        <nav aria-label="Departments" className="flex flex-wrap gap-2">
          <Link href={`/o/${slug}`} className={chip(!d)} aria-current={!d ? "page" : undefined}>All offices</Link>
          {deps.map((dep) => (
            <Link key={dep.id} href={`/o/${slug}?d=${dep.id}`} className={chip(d === dep.id)} aria-current={d === dep.id ? "page" : undefined}>
              {dep.name}
            </Link>
          ))}
        </nav>
      )}

      {shown.length ? (
        <ul className="ruled">
          {shown.map((o) => (
            <li key={o.id}>
              <Link href={`/o/${slug}/${o.id}`} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto]">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{o.user.name}</span>
                  <span className="block text-sm text-muted">{o.designation}{o.department ? `, ${o.department.name}` : ""}</span>
                </span>
                <span className="hidden text-sm text-ink-2 sm:block">
                  {o.slotDurationMin === o.maxDurationMin ? `${o.slotDurationMin} min meetings` : `${o.slotDurationMin} to ${o.maxDurationMin} min meetings`}
                  {o.location ? <span className="block text-muted">{o.location}</span> : null}
                </span>
                <span className="flex items-center gap-3">
                  {o.requiresApproval && <span className="tag tag--wait">Needs approval</span>}
                  <span className="btn btn--sm group-hover:border-ink">Book</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="No officers are taking bookings right now.">Please check back later.</Empty>
      )}
    </div>
  );
}
