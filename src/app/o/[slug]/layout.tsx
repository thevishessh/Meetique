import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Logo } from "@/components/ui";

export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({ where: { slug }, select: { name: true, slug: true, address: true, phone: true, email: true } });
  if (!org) notFound();
  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href={`/o/${org.slug}`} className="min-w-0">
            <div className="truncate text-lg font-semibold text-slate-900">{org.name}</div>
            <div className="text-xs text-slate-500">Online appointment booking</div>
          </Link>
          <Link href={`/o/${org.slug}/find`} className="rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">Find my booking</Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      <footer className="no-print mx-auto max-w-4xl px-4 pb-10 text-xs text-slate-400">
        {[org.address, org.phone, org.email].filter(Boolean).join(" · ")}
        <div className="mt-3"><Link href="/"><Logo className="text-xs opacity-60 [&>span:first-child]:h-5 [&>span:first-child]:w-5" /></Link></div>
      </footer>
    </div>
  );
}
