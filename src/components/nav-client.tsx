"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { cx } from "./ui";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1">
      {items.map((i) => {
        const active = i.href === path || (i.href !== "/admin" && i.href !== "/officer" && path.startsWith(i.href + "/"));
        return (
          <Link
            key={i.href}
            href={i.href}
            className={cx("whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition", active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800")}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

/** Re-fetches server data periodically (live queue) */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
