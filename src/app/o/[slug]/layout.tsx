import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser, homeFor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PRODUCT_NAME, PUBLIC_BOOKING } from "@/lib/config";
import { AppShell } from "@/components/app-shell";

export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({ where: { slug }, select: { name: true, slug: true, address: true, phone: true, email: true } });
  if (!org) notFound();
  const me = await getUser();
  if (!PUBLIC_BOOKING && (!me || me.org.slug !== org.slug)) redirect("/login");
  // Internal mode: signed-in staff get the same shell, top bar and tabs as every other screen
  if (me && !PUBLIC_BOOKING) return <AppShell user={me}>{children}</AppShell>;

  return (
    <div className="min-h-screen bg-paper">
      <header className="no-print border-b border-rule bg-paper">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-4">
          <Link href={`/o/${org.slug}`} className="min-w-0">
            <div className="truncate text-lg font-semibold text-ink">{org.name}</div>
            <div className="text-xs text-muted">{PUBLIC_BOOKING ? "Online appointment booking" : "Staff meeting booking"}</div>
          </Link>
          {me && !PUBLIC_BOOKING ? (
            <nav className="flex items-center gap-1">
              <Link href="/me" className="btn btn--ghost btn--sm">My meetings</Link>
              <Link href={homeFor(me.role)} className="btn btn--ghost btn--sm">Back to my desk</Link>
            </nav>
          ) : (
            <nav className="flex items-center gap-1">
              <Link href={`/o/${org.slug}/find`} className="btn btn--ghost btn--sm">Find my booking</Link>
              <Link href="/login" className="btn btn--ghost btn--sm">Staff login</Link>
            </nav>
          )}
        </div>
      </header>
      <main className="container py-10">{children}</main>
      <footer className="no-print container border-t border-rule py-8 text-sm text-muted">
        {[org.address, org.phone, org.email].filter(Boolean).join(", ")}
        <div className="mt-3">Powered by {PRODUCT_NAME}</div>
      </footer>
    </div>
  );
}
