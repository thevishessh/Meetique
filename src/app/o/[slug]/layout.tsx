import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser, homeFor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PRODUCT_NAME, PUBLIC_BOOKING } from "@/lib/config";

export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({ where: { slug }, select: { name: true, slug: true, address: true, phone: true, email: true } });
  if (!org) notFound();
  const me = await getUser();
  if (!PUBLIC_BOOKING && (!me || me.org.slug !== org.slug)) redirect("/login");
  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-rule bg-paper">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href={`/o/${org.slug}`} className="min-w-0">
            <div className="truncate text-lg font-semibold text-ink">{org.name}</div>
            <div className="text-xs text-muted">{PUBLIC_BOOKING ? "Online appointment booking" : "Staff meeting booking"}</div>
          </Link>
          {me && !PUBLIC_BOOKING ? (
            <nav className="flex items-center gap-1">
              <Link href="/me" className="rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-accent-soft">My meetings</Link>
              <Link href={homeFor(me.role)} className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-paper-3 hover:text-ink">Back to my desk</Link>
            </nav>
          ) : (
            <nav className="flex items-center gap-1">
              <Link href={`/o/${org.slug}/find`} className="rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-accent-soft">Find my booking</Link>
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-paper-3 hover:text-ink">Staff login</Link>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      <footer className="no-print mx-auto max-w-4xl px-4 pb-10 text-xs text-muted">
        {[org.address, org.phone, org.email].filter(Boolean).join(", ")}
        <div className="mt-3">Powered by {PRODUCT_NAME}</div>
      </footer>
    </div>
  );
}
