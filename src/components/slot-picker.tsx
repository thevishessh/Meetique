"use client";
import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { cx } from "./ui";

type Slot = { start: string; end: string; label: string; booked: number; capacity: number; available: boolean; reason?: string };
type Day = { date: string; timezone: string; status: string; message?: string; durationMin: number; durations: number[]; breaks: { label: string }[]; slots: Slot[] };

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
  duration,
  onDuration,
}: {
  officerId: string;
  startDate: string;
  days?: { date: string; open: number }[];
  count?: number;
  value: string | null;
  onChange: (start: string | null, label?: string, date?: string) => void;
  staff?: boolean;
  ignore?: string;
  /** Selected meeting length (minutes). Omit to use the officer's slot length. */
  duration?: number;
  /** When given, the booker can choose the meeting length */
  onDuration?: (min: number) => void;
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
    const qs = new URLSearchParams({ officerId, date, ...(staff ? { staff: "1" } : {}), ...(ignore ? { ignore } : {}), ...(duration ? { duration: String(duration) } : {}) });
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
  }, [officerId, date, staff, ignore, tick, duration]);

  // Refresh availability every 30s so visitors see slots taken by others
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Hide slots that have already passed: they only add noise
  const shown = day?.slots.filter((s) => s.reason !== "PAST") ?? [];
  const available = shown.filter((s) => s.available).length;

  const lengths = day?.durations ?? [];
  const fmtLen = (m: number) => (m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} hour${m > 60 ? "s" : ""}` : `${Math.floor(m / 60)} h ${m % 60} min`);
  return (
    <div>
      {onDuration && lengths.length > 1 && (
        <fieldset className="mb-6">
          <legend className="field-label">Meeting length</legend>
          <div className="flex flex-wrap gap-2">
            {lengths.map((m) => {
              const active = (duration ?? day?.durationMin) === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onDuration(m);
                    onChange(null);
                  }}
                  className={cx("btn btn--sm", active && "btn--primary")}
                >
                  {fmtLen(m)}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="field-label">Day</div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="group" aria-label="Choose a day">
        {dates.map((d) => {
          const dt = DateTime.fromISO(d.date);
          const active = d.date === date;
          const closed = d.open === 0;
          return (
            <button
              key={d.date}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setDate(d.date);
                onChange(null);
              }}
              className={cx(
                "flex min-w-[4.5rem] shrink-0 flex-col items-center rounded-[10px] border px-3 py-2 text-center transition-colors duration-[var(--dur-micro)]",
                active ? "border-ink bg-ink text-paper" : closed ? "border-rule-2 bg-paper-2 text-muted" : "border-rule bg-paper text-ink hover:border-ink",
              )}
            >
              <span className="text-xs">{dt.toFormat("ccc")}</span>
              <span className="num font-display text-xl font-bold leading-tight">{dt.toFormat("d")}</span>
              <span className="text-xs">{dt.toFormat("LLL")}</span>
              {d.open >= 0 && <span className={cx("mt-1 text-xs", active ? "text-paper" : closed ? "text-muted" : "text-accent")}>{closed ? "Closed" : `${d.open} free`}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-6 min-h-32">
        {loading && !day ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-busy="true" aria-label="Loading free times">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-14 rounded-[10px] bg-paper-3" />)}
          </div>
        ) : err ? (
          <p role="alert" className="note note--error">{err}</p>
        ) : day && shown.length === 0 ? (
          <div className="well px-5 py-6 text-sm text-ink-2">{day.message ?? (day.slots.length ? "All of today's times have passed. Pick another day." : "No free times on this day. Pick another day.")}</div>
        ) : day ? (
          <>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-ink pb-2 text-sm">
              <span className="font-semibold text-ink">{DateTime.fromISO(date).toFormat("cccc, d LLLL")}</span>
              <span className="text-muted">
                {available} of {shown.length} free{day.breaks.length ? `, break ${day.breaks.map((b) => b.label).join(", ")}` : ""}
              </span>
            </div>
            {day.message && <p className="mb-3 text-sm text-ink">{day.message}</p>}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {shown.map((s) => {
                const selected = value === s.start;
                return (
                  <button
                    key={s.start}
                    type="button"
                    aria-pressed={selected}
                    disabled={!s.available}
                    onClick={() => onChange(s.start, s.label, date)}
                    className={cx(
                      "flex h-14 flex-col items-center justify-center rounded-[10px] border text-sm transition-colors duration-[var(--dur-micro)] disabled:cursor-not-allowed",
                      selected ? "border-ink bg-ink font-semibold text-paper" : s.available ? "border-rule bg-paper font-semibold text-ink hover:border-accent hover:bg-accent-soft" : "border-rule-2 bg-paper-2 text-muted",
                    )}
                  >
                    <span className="num">{s.label}</span>
                    <span className={cx("text-xs font-normal", selected ? "text-paper" : s.available ? "text-muted" : "")}>
                      {!s.available ? REASON[s.reason ?? "FULL"] : s.capacity > 1 ? `${s.capacity - s.booked} of ${s.capacity} left` : `till ${DateTime.fromISO(s.end).setZone(day.timezone).toFormat("h:mm a")}`}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted">Times in {day.timezone}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
