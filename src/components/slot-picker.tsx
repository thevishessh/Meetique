"use client";
import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { cx } from "./ui";

type Slot = { start: string; end: string; label: string; booked: number; capacity: number; available: boolean; reason?: string };
type Day = { date: string; timezone: string; status: string; message?: string; breaks: { label: string }[]; slots: Slot[] };

const REASON: Record<string, string> = { FULL: "Booked", PAST: "Passed", NOTICE: "Too soon", SAME_DAY: "Closed", DAY_LIMIT: "Day full", NOT_BOOKABLE: "Closed" };

export default function SlotPicker({
  officerId,
  startDate,
  days,
  count = 14,
  value,
  onChange,
  staff,
  ignore,
}: {
  officerId: string;
  startDate: string;
  days?: { date: string; open: number }[];
  count?: number;
  value: string | null;
  onChange: (start: string | null, label?: string, date?: string) => void;
  staff?: boolean;
  ignore?: string;
}) {
  const dates = days ?? Array.from({ length: count }, (_, i) => ({ date: DateTime.fromISO(startDate).plus({ days: i }).toFormat("yyyy-MM-dd"), open: -1 }));
  const firstOpen = dates.find((d) => d.open !== 0)?.date ?? dates[0].date;
  const [date, setDate] = useState(firstOpen);
  const [day, setDay] = useState<Day | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    const qs = new URLSearchParams({ officerId, date, ...(staff ? { staff: "1" } : {}), ...(ignore ? { ignore } : {}) });
    fetch(`/api/slots?${qs}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error?.message ?? "Failed to load slots");
        if (alive) setDay(d);
      })
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [officerId, date, staff, ignore, tick]);

  // Refresh availability every 30s so visitors see slots taken by others
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Hide slots that have already passed — they only add noise
  const shown = day?.slots.filter((s) => s.reason !== "PAST") ?? [];
  const available = shown.filter((s) => s.available).length;

  return (
    <div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {dates.map((d) => {
          const dt = DateTime.fromISO(d.date);
          const active = d.date === date;
          const closed = d.open === 0;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => {
                setDate(d.date);
                onChange(null);
              }}
              className={cx(
                "flex min-w-[4.25rem] shrink-0 flex-col items-center rounded-xl px-3 py-2 text-center ring-1 ring-inset transition",
                active ? "bg-brand-600 text-white ring-brand-600" : closed ? "bg-slate-50 text-slate-400 ring-slate-200" : "bg-white text-slate-700 ring-slate-200 hover:ring-brand-300",
              )}
            >
              <span className="text-[11px] font-medium uppercase">{dt.toFormat("ccc")}</span>
              <span className="text-lg font-semibold leading-tight">{dt.toFormat("d")}</span>
              <span className="text-[11px]">{dt.toFormat("LLL")}</span>
              {d.open >= 0 && <span className={cx("mt-0.5 text-[10px]", active ? "text-brand-100" : closed ? "" : "text-emerald-600")}>{closed ? "—" : `${d.open} open`}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-4 min-h-32">
        {loading && !day ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}</div>
        ) : err ? (
          <p className="text-sm text-rose-600">{err}</p>
        ) : day && shown.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{day.message ?? (day.slots.length ? "All slots for today have passed." : "No slots on this day.")}</div>
        ) : day ? (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-slate-700">{DateTime.fromISO(date).toFormat("cccc, d LLLL")}</span>
              <span className="text-slate-500">{available} of {shown.length} slots available{day.breaks.length ? ` · Break ${day.breaks.map((b) => b.label).join(", ")}` : ""}</span>
            </div>
            {day.message && <p className="mb-3 text-sm text-amber-700">{day.message}</p>}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {shown.map((s) => {
                const selected = value === s.start;
                return (
                  <button
                    key={s.start}
                    type="button"
                    disabled={!s.available}
                    onClick={() => onChange(s.start, s.label, date)}
                    className={cx(
                      "flex h-14 flex-col items-center justify-center rounded-lg text-sm ring-1 ring-inset transition",
                      selected
                        ? "bg-brand-600 font-semibold text-white ring-brand-600"
                        : s.available
                          ? "bg-white font-medium text-slate-800 ring-slate-300 hover:bg-brand-50 hover:ring-brand-400"
                          : "cursor-not-allowed bg-slate-50 text-slate-400 ring-slate-200",
                    )}
                  >
                    <span>{s.label}</span>
                    <span className={cx("text-[10px] font-normal", selected ? "text-brand-100" : "")}>
                      {!s.available ? REASON[s.reason ?? "FULL"] : s.capacity > 1 ? `${s.capacity - s.booked} of ${s.capacity} left` : "Available"}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-400">Times shown in {day.timezone}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
