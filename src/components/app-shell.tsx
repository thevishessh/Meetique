import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { Logo } from "./ui";
import { NavLinks, LogoutButton } from "./nav-client";
import { UrgentAlert } from "./urgent-alert";

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
      return [mine, book];
    default:
      return [{ href: "/reception", label: "Reception desk" }];
  }
}

const ROLE_LABEL: Record<SessionUser["role"], string> = { ADMIN: "Organization admin", OFFICER: "Officer", RECEPTIONIST: "Reception", STAFF: "Staff" };

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="shrink-0"><Logo /></Link>
          <span className="hidden truncate rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 md:inline">{user.org.name}</span>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/account" className="hidden text-right sm:block" title="My account / change password">
              <div className="text-sm font-medium leading-tight text-slate-900 hover:text-brand-700">{user.name}</div>
              <div className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</div>
            </Link>
            <LogoutButton />
          </div>
        </div>
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6">
          <NavLinks items={navFor(user)} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <UrgentAlert />
        {children}
      </main>
    </div>
  );
}
