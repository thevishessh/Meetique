import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { Logo } from "./ui";
import { NavLinks, LogoutButton } from "./nav-client";

const NAV: Record<SessionUser["role"], { href: string; label: string }[]> = {
  ADMIN: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/appointments", label: "Appointments" },
    { href: "/reception", label: "Reception" },
    { href: "/admin/officers", label: "Officers" },
    { href: "/admin/departments", label: "Departments" },
    { href: "/admin/staff", label: "Staff" },
    { href: "/admin/reports", label: "Reports" },
    { href: "/admin/settings", label: "Settings" },
  ],
  OFFICER: [
    { href: "/officer", label: "My queue" },
    { href: "/officer/appointments", label: "Appointments" },
    { href: "/officer/availability", label: "Availability" },
  ],
  RECEPTIONIST: [{ href: "/reception", label: "Reception desk" }],
};

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="shrink-0"><Logo /></Link>
          <span className="hidden truncate rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 md:inline">{user.org.name}</span>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight text-slate-900">{user.name}</div>
              <div className="text-xs text-slate-500">{user.role === "ADMIN" ? "Organization admin" : user.role === "OFFICER" ? "Officer" : "Reception"}</div>
            </div>
            <LogoutButton />
          </div>
        </div>
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6">
          <NavLinks items={NAV[user.role]} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
