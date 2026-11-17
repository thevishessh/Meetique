import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { Logo } from "./ui";
import { NavLinks, LogoutButton } from "./nav-client";
import { UrgentAlert } from "./urgent-alert";
import { NotificationBell } from "./notification-bell";
import { PushPrompt } from "./push-client";

function navFor(user: SessionUser): { href: string; label: string }[] {
  const book = { href: `/o/${user.org.slug}`, label: "Book a meeting" };
  const mine = { href: "/me", label: "My meetings" };
  switch (user.role) {
    case "ADMIN":
      return [
        { href: "/admin", label: "Overview" },
        { href: "/admin/appointments", label: "Appointments" },
        { href: "/reception", label: "Reception" },
        { href: "/admin/officers", label: "Officers" },
        { href: "/admin/departments", label: "Departments" },
        { href: "/admin/staff", label: "Staff" },
        { href: "/admin/holidays", label: "Holidays" },
        { href: "/admin/reports", label: "Reports" },
        { href: "/admin/settings", label: "Settings" },
      ];
    case "OFFICER":
      return [
        { href: "/officer", label: "My queue" },
        { href: "/officer/appointments", label: "Appointments" },
        ...(user.canSummon ? [{ href: "/officer/summon", label: "Call immediate meeting" }] : []),
        { href: "/officer/availability", label: "Availability" },
        mine,
        book,
      ];
    case "STAFF":
      return user.pa ? [mine, book, { href: "/reception", label: `Reception for ${user.pa.officerName}` }] : [mine, book];
    default:
      return [{ href: "/reception", label: "Reception desk" }];
  }
}

const ROLE_LABEL: Record<SessionUser["role"], string> = { ADMIN: "Organization admin", OFFICER: "Officer", RECEPTIONIST: "Reception", STAFF: "Staff" };

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="no-print sticky top-0 z-[var(--z-sticky-nav)] border-b border-rule bg-paper">
        <div className="container flex items-center gap-4 pt-4 pb-2">
          <Link href="/" className="flex min-w-0 shrink-0 flex-col leading-tight" aria-label={`${user.org.name}, home`}>
            <Logo />
            <span className="hidden truncate text-xs text-muted md:block">{user.org.name}</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/account" className="mr-2 hidden text-right sm:block" title="My account: phone alerts and password">
              <div className="text-sm font-semibold leading-tight text-ink underline decoration-transparent underline-offset-4 hover:decoration-accent">{user.name}</div>
              <div className="text-xs text-muted">{user.pa ? `PA to ${user.pa.officerName}` : ROLE_LABEL[user.role]}</div>
            </Link>
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
        <div className="container overflow-x-auto">
          <NavLinks items={navFor(user)} />
        </div>
      </header>
      <main className="container py-10">
        <UrgentAlert />
        <PushPrompt />
        {children}
      </main>
    </div>
  );
}
