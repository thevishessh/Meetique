"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./client-api";
import { Button } from "./ui";

type Urgent = { id: string; officer: string; designation: string; location: string | null; when: string; purpose: string | null; response: "ACKNOWLEDGED" | "ON_MY_WAY" | null; status: string };

/** Short two-tone alert sound (Web Audio — no file needed) */
function beep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    [880, 660, 880].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g).connect(ctx.destination);
      g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.25);
      o.start(ctx.currentTime + i * 0.25);
      o.stop(ctx.currentTime + i * 0.25 + 0.2);
    });
  } catch {
    /* browsers may block sound until the user interacts with the page */
  }
}

/**
 * Shown on every staff screen. Polls for immediate meetings someone has called this user into,
 * plays a sound for new ones, and lets them reply "Acknowledge" / "On my way".
 */
export function UrgentAlert() {
  const router = useRouter();
  const [items, setItems] = useState<Urgent[]>([]);
  const seen = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<Urgent[]>("/api/me/urgent");
      const fresh = data.filter((d) => !d.response && seen.current && !seen.current.has(d.id));
      if (fresh.length) {
        beep();
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Immediate meeting", { body: `${fresh[0].officer} has called you${fresh[0].location ? ` — ${fresh[0].location}` : ""}` });
        }
      }
      seen.current = new Set(data.map((d) => d.id));
      setItems(data);
    } catch {
      /* signed out or offline — try again next tick */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 15_000);
    if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission().catch(() => {});
    return () => clearInterval(t);
  }, [load]);

  if (!items.length) return null;
  return (
    <div className="no-print mb-6 space-y-3">
      {items.map((u) => (
        <div key={u.id} className={`rounded-2xl p-4 ring-1 ring-inset sm:p-5 ${u.response ? "bg-amber-50 ring-amber-200" : "animate-pulse bg-rose-50 ring-rose-300 [animation-iteration-count:3]"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-rose-700">Immediate meeting{u.response === "ON_MY_WAY" ? " · you're on the way" : u.response === "ACKNOWLEDGED" ? " · acknowledged" : ""}</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{u.officer} <span className="font-normal text-slate-600">({u.designation})</span> has called you</div>
              <div className="text-sm text-slate-700">{u.when}{u.location ? ` · ${u.location}` : ""}</div>
              {u.purpose && <div className="mt-1 text-sm text-slate-600">“{u.purpose}”</div>}
            </div>
            <div className="flex gap-2">
              {!u.response && <Button variant="secondary" onClick={async () => { await api(`/api/appointments/${u.id}/respond`, { body: { response: "ACKNOWLEDGED" } }); await load(); router.refresh(); }}>Acknowledge</Button>}
              {u.response !== "ON_MY_WAY" && <Button variant="success" onClick={async () => { await api(`/api/appointments/${u.id}/respond`, { body: { response: "ON_MY_WAY" } }); await load(); router.refresh(); }}>On my way</Button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
