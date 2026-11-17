"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "./client-api";
import { cx } from "./ui";

type N = { id: string; title: string; body: string; url: string | null; urgent: boolean; readAt: string | null; createdAt: string };

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

/** Bell with unread count; polls every 20 s */
export function NotificationBell() {
  const [data, setData] = useState<{ unread: number; items: N[] }>({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    try {
      setData(await api("/api/notifications"));
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(load, 20_000);
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => {
      clearInterval(t);
      document.removeEventListener("click", close);
    };
  }, [load]);

  return (
    <div ref={box} className="relative">
      <button
        aria-label={`Notifications${data.unread ? ` (${data.unread} unread)` : ""}`}
        type="button"
        className="btn btn--ghost btn--sm w-8 px-0"
        onClick={async () => {
          setOpen((o) => !o);
          if (!open && data.unread) {
            await api("/api/notifications/read", { method: "POST" }).catch(() => {});
            setData((d) => ({ ...d, unread: 0 }));
          }
        }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {data.unread > 0 && <span className="num absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-pill bg-ink px-1 text-xs font-semibold text-paper">{data.unread > 9 ? "9+" : data.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-[var(--z-dropdown)] mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-rule bg-paper shadow-card">
          <div className="border-b border-ink px-4 py-3 text-sm font-semibold text-ink">Notifications</div>
          <ul className="max-h-96 divide-y divide-rule overflow-y-auto">
            {data.items.map((n) => (
              <li key={n.id}>
                <Link href={n.url ?? "#"} onClick={() => setOpen(false)} className={cx("block px-4 py-3 text-sm hover:bg-paper-2", !n.readAt && "bg-paper-2")}>
                  <div className={cx("text-ink", n.urgent ? "font-bold" : "font-semibold")}>{n.title}</div>
                  <div className="whitespace-pre-line text-xs text-ink-2">{n.body}</div>
                  <div className="mt-1 text-xs text-muted">{ago(n.createdAt)}</div>
                </Link>
              </li>
            ))}
            {!data.items.length && <li className="px-4 py-6 text-center text-sm text-muted">No notifications yet</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
