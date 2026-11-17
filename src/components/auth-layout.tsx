import Link from "next/link";
import { prisma } from "@/lib/db";
import { CLIENT_ORG_SLUG } from "@/lib/config";
import { Logo } from "./ui";

/** Sign-in family of pages: the name and what to do on the left, the form in a well on the right */
export async function AuthLayout({ title, lead, children, foot }: { title: string; lead?: React.ReactNode; children: React.ReactNode; foot?: React.ReactNode }) {
  const org = CLIENT_ORG_SLUG ? await prisma.organization.findUnique({ where: { slug: CLIENT_ORG_SLUG }, select: { name: true } }) : null;
  return (
    <div className="min-h-screen bg-paper">
      <div className="container grid min-h-screen grid-rows-[auto_1fr] gap-10 py-8 lg:grid-cols-12 lg:grid-rows-1 lg:items-center lg:gap-[var(--gap-columns)]">
        <div className="flex flex-col gap-8 lg:col-span-6 lg:self-stretch lg:justify-between lg:py-4">
          <Link href="/" aria-label="Home" className="w-fit">
            <Logo />
            {org && <span className="block text-sm text-muted">{org.name}</span>}
          </Link>
          <div className="max-w-md">
            <h1 className="font-display text-[length:var(--text-3xl)] font-bold leading-[1.02] tracking-[var(--tracking-display)] text-ink sm:text-[2.75rem]">{title}</h1>
            {lead && <p className="mt-4 text-md text-ink-2">{lead}</p>}
          </div>
          <div className="hidden lg:block" />
        </div>
        <div className="w-full max-w-md lg:col-span-5 lg:col-start-8">
          <div className="well p-6 sm:p-8">{children}</div>
          {foot && <div className="mt-4 px-1 text-sm text-ink-2">{foot}</div>}
        </div>
      </div>
    </div>
  );
}
