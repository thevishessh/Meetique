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
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href={`/o/${org.slug}`} className="min-w-0">
            <div className="truncate text-lg font-semibold text-slate-900">{org.name}</div>
            <div className="text-xs text-slate-500">{PUBLIC_BOOKING ? "Online appointment booking" : "Staff meeting booking"}</div>
          </Link>
          {me && !PUBLIC_BOOKING ? (
            <nav className="flex items-center gap-1">
              <Link href="/me" className="rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">My meetings</Link>
              <Link href={homeFor(me.role)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">{me.name} →</Link>
            </nav>
          ) : (
            <nav className="flex items-center gap-1">
              <Link href={`/o/${org.slug}/find`} className="rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">Find my booking</Link>
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">Staff login</Link>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      <footer className="no-print mx-auto max-w-4xl px-4 pb-10 text-xs text-slate-400">
        {[org.address, org.phone, org.email].filter(Boolean).join(" · ")}
        <div className="mt-3">Powered by {PRODUCT_NAME}</div>
      </footer>
    </div>
  );
}
