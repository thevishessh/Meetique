"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./client-api";
import { Button } from "./ui";

type Urgent = { id: string; officer: string; designation: string; location: string | null; when: string; purpose: string | null; response: "ACKNOWLEDGED" | "ON_MY_WAY" | null; status: string };

/** Short two-tone alert sound (Web Audio, no file needed) */
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
          new Notification("Immediate meeting", { body: `${fresh[0].officer} has called you${fresh[0].location ? `, ${fresh[0].location}` : ""}` });
        }
      }
      seen.current = new Set(data.map((d) => d.id));
      setItems(data);
    } catch {
      /* signed out or offline: try again next tick */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 15_000);
    if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission().catch(() => {});
    return () => clearInterval(t);
  }, [load]);

  if (!items.length) return null;
  const respond = async (id: string, response: "ACKNOWLEDGED" | "ON_MY_WAY") => {
    await api(`/api/appointments/${id}/respond`, { body: { response } });
    await load();
    router.refresh();
  };
  return (
    <div className="no-print mb-8 space-y-3" role="region" aria-label="Immediate meetings">
      {items.map((u) => (
        <div
          key={u.id}
          role={u.response ? undefined : "alert"}
          className={u.response ? "well px-5 py-4" : "rounded-card bg-ink px-5 py-5 text-paper"}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={u.response ? "tag tag--on" : "tag"}>Immediate meeting</span>
                {u.response && <span className="tag tag--in">{u.response === "ON_MY_WAY" ? "You're on the way" : "Acknowledged"}</span>}
              </div>
              <p className={`mt-2 font-display text-xl font-bold tracking-[var(--tracking-display)] ${u.response ? "text-ink" : "text-paper"}`}>
                {u.officer} has called you
              </p>
              <p className={`mt-1 text-sm ${u.response ? "text-ink-2" : "text-paper"}`}>
                {u.designation}, {u.when}
                {u.location && <><br />{u.location}</>}
              </p>
              {u.purpose && <p className={`mt-2 text-sm ${u.response ? "text-ink-2" : "text-paper"}`}>“{u.purpose}”</p>}
            </div>
            <div className="flex gap-2">
              {!u.response && <Button type="button" variant="secondary" onClick={() => respond(u.id, "ACKNOWLEDGED")}>Acknowledge</Button>}
              {u.response !== "ON_MY_WAY" && <Button type="button" variant="success" onClick={() => respond(u.id, "ON_MY_WAY")}>On my way</Button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
