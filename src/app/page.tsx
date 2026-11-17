import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUser, homeFor } from "@/lib/auth";
import { ALLOW_ORG_SIGNUP, APP_NAME, APP_TAGLINE, CLIENT_ORG_SLUG, PUBLIC_BOOKING } from "@/lib/config";
import { ButtonLink, Card, Logo } from "@/components/ui";

export const dynamic = "force-dynamic";

const FEATURES = [
  { t: "Multiple officers", d: "Every officer sets their own working days, hours, breaks, slot length, buffer and capacity." },
  { t: "No double booking", d: "Row locks + a PostgreSQL exclusion constraint make overlapping bookings impossible." },
  { t: "Instant QR tokens", d: "Each booking gets a unique token like ABC-2026-000124 and a QR with no personal data." },
  { t: "Reception queue", d: "Scan QR to check in, track Waiting → In Progress → Completed, register walk-ins." },
  { t: "Self-service visitors", d: "Visitors book without an account and can reschedule or cancel from their link." },
  { t: "Reports", d: "Status breakdowns, officer workload, no-shows, and CSV export for Excel." },
];

export default async function Home() {
  if (!PUBLIC_BOOKING) {
    // Internal mode: everything is behind staff login
    const me = await getUser();
    redirect(me ? homeFor(me.role) : "/login");
  }
  if (CLIENT_ORG_SLUG) redirect(`/o/${CLIENT_ORG_SLUG}`);
  const [user, orgs] = await Promise.all([getUser(), prisma.organization.findMany({ select: { name: true, slug: true }, orderBy: { createdAt: "asc" }, take: 6 })]);
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <ButtonLink href={homeFor(user.role)}>Open dashboard</ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost">Sign in</ButtonLink>
              {ALLOW_ORG_SIGNUP && <ButtonLink href="/register">Register organization</ButtonLink>}
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <section className="py-14 text-center sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wider text-ink">Appointments · QR tokens · Queues</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-semibold text-ink sm:text-5xl">{APP_TAGLINE}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-2">
            {APP_NAME} lets universities, hospitals, offices and professionals publish officer availability, take bookings, issue QR tokens and run the reception queue — from one place.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {ALLOW_ORG_SIGNUP && <ButtonLink href="/register" size="lg">Create your organization</ButtonLink>}
            {orgs[0] && <ButtonLink href={`/o/${orgs[0].slug}`} size="lg" variant="secondary">Try the booking portal</ButtonLink>}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.t} className="p-6">
              <h3 className="font-semibold text-ink">{f.t}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-2">{f.d}</p>
            </Card>
          ))}
        </section>

        {orgs.length > 0 && (
          <section className="mt-14">
            <h2 className="text-lg font-semibold text-ink">Book an appointment</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {orgs.map((o) => (
                <Link key={o.slug} href={`/o/${o.slug}`} className="rounded-xl bg-paper px-4 py-3 text-sm font-medium text-ink ring-1 ring-rule hover:ring-ink">
                  {o.name} →
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
