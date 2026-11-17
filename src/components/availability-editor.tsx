"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./client-api";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Select } from "./ui";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DURATIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120];

export type Hours = { weekday: number; startTime: string; endTime: string; breakStart: string | null; breakEnd: string | null };
export type Settings = {
  slotDurationMin: number;
  bufferMin: number;
  capacityPerSlot: number;
  maxPerDay: number | null;
  advanceBookingDays: number;
  minNoticeMin: number;
  allowSameDay: boolean;
  isBookable: boolean;
  maxDurationMin: number;
  requiresApproval: boolean;
};
export type BlockView = { id: string; kind: "UNAVAILABLE" | "AVAILABLE"; label: string; reason: string | null };

export function AvailabilityEditor({ officerId, hours, settings, blocks, timezone }: { officerId: string; hours: Hours[]; settings: Settings; blocks: BlockView[]; timezone: string }) {
  const router = useRouter();
  const [days, setDays] = useState(() =>
    DAYS.map((_, i) => {
      const h = hours.find((x) => x.weekday === i + 1);
      return { weekday: i + 1, enabled: !!h, startTime: h?.startTime ?? "10:00", endTime: h?.endTime ?? "14:00", breakStart: h?.breakStart ?? "", breakEnd: h?.breakEnd ?? "" };
    }),
  );
  const [s, setS] = useState(settings);
  const [msg, setMsg] = useState<{ tone: "green" | "rose"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const upd = (i: number, patch: Partial<(typeof days)[number]>) => setDays((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/availability", { body: { officerId, days, settings: { ...s, maxPerDay: s.maxPerDay || null, maxDurationMin: Math.max(s.maxDurationMin, s.slotDurationMin) } } });
      setMsg({ tone: "green", text: "Availability saved. New slots are live for visitors." });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "rose", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const perDay = (d: (typeof days)[number]) => {
    if (!d.enabled) return 0;
    const m = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3);
    // Start times on the slot grid (shortest meeting); a buffer is kept after each booked meeting
    const step = s.slotDurationMin;
    const win = (a: number, b: number) => (b - a >= s.slotDurationMin ? Math.floor((b - a - s.slotDurationMin) / step) + 1 : 0);
    if (d.breakStart && d.breakEnd) return win(m(d.startTime), m(d.breakStart)) + win(m(d.breakEnd), m(d.endTime));
    return win(m(d.startTime), m(d.endTime));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Weekly working hours" description={`Times in ${timezone}. Slots are generated automatically from these hours.`} />
        <div className="divide-y divide-slate-100">
          {days.map((d, i) => (
            <div key={d.weekday} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <label className="flex w-36 items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={d.enabled} onChange={(e) => upd(i, { enabled: e.target.checked })} className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
                {DAYS[i]}
              </label>
              {d.enabled ? (
                <>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Input type="time" value={d.startTime} onChange={(e) => upd(i, { startTime: e.target.value })} className="h-9 w-32" />
                    <span className="text-slate-400">to</span>
                    <Input type="time" value={d.endTime} onChange={(e) => upd(i, { endTime: e.target.value })} className="h-9 w-32" />
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-slate-500">Break</span>
                    <Input type="time" value={d.breakStart} onChange={(e) => upd(i, { breakStart: e.target.value })} className="h-9 w-32" />
                    <span className="text-slate-400">–</span>
                    <Input type="time" value={d.breakEnd} onChange={(e) => upd(i, { breakEnd: e.target.value })} className="h-9 w-32" />
                    {(d.breakStart || d.breakEnd) && <button className="text-xs text-slate-400 hover:text-rose-600" onClick={() => upd(i, { breakStart: "", breakEnd: "" })}>clear</button>}
                  </div>
                  <Badge tone="brand">{perDay(d)} start times</Badge>
                </>
              ) : (
                <span className="text-sm text-slate-400">Day off</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Booking rules" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Slot length (shortest meeting)" hint="Booking grid; staff can book 1, 2, 3… slots">
            <Select value={s.slotDurationMin} onChange={(e) => setS({ ...s, slotDurationMin: +e.target.value })}>
              {DURATIONS.map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </Select>
          </Field>
          <Field label="Longest meeting allowed" hint="Staff choose any length up to this">
            <Select value={Math.max(s.maxDurationMin, s.slotDurationMin)} onChange={(e) => setS({ ...s, maxDurationMin: +e.target.value })}>
              {Array.from({ length: 8 }, (_, i) => s.slotDurationMin * (i + 1)).filter((m) => m <= 480).map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </Select>
          </Field>
          <Field label="Buffer after each meeting (min)" hint="Gap kept free after every meeting">
            <Input type="number" min={0} max={60} value={s.bufferMin} onChange={(e) => setS({ ...s, bufferMin: +e.target.value })} />
          </Field>
          <Field label="Capacity per slot" hint="Visitors allowed in one slot">
            <Input type="number" min={1} max={100} value={s.capacityPerSlot} onChange={(e) => setS({ ...s, capacityPerSlot: +e.target.value })} />
          </Field>
          <Field label="Max bookings per day" hint="Empty = no limit">
            <Input type="number" min={1} value={s.maxPerDay ?? ""} onChange={(e) => setS({ ...s, maxPerDay: e.target.value ? +e.target.value : null })} />
          </Field>
          <Field label="Advance booking limit" hint="Days ahead visitors can book">
            <Input type="number" min={1} max={365} value={s.advanceBookingDays} onChange={(e) => setS({ ...s, advanceBookingDays: +e.target.value })} />
          </Field>
          <Field label="Minimum notice (minutes)" hint="e.g. 60 = book at least 1 hour ahead">
            <Input type="number" min={0} value={s.minNoticeMin} onChange={(e) => setS({ ...s, minNoticeMin: +e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
            <input type="checkbox" checked={s.allowSameDay} onChange={(e) => setS({ ...s, allowSameDay: e.target.checked })} className="h-4 w-4 accent-brand-600" />
            Allow same-day booking
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
            <input type="checkbox" checked={s.isBookable} onChange={(e) => setS({ ...s, isBookable: e.target.checked })} className="h-4 w-4 accent-brand-600" />
            Accepting online bookings
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
            <input type="checkbox" checked={s.requiresApproval} onChange={(e) => setS({ ...s, requiresApproval: e.target.checked })} className="h-4 w-4 accent-brand-600" />
            Bookings need my approval
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-4">
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save availability"}</Button>
          {msg && <span className={msg.tone === "green" ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{msg.text}</span>}
        </div>
      </Card>

      <BlocksCard officerId={officerId} blocks={blocks} timezone={timezone} />
    </div>
  );
}

function BlocksCard({ officerId, blocks, timezone }: { officerId: string; blocks: BlockView[]; timezone: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<"UNAVAILABLE" | "AVAILABLE">("UNAVAILABLE");
  const [allDay, setAllDay] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Card>
      <CardHeader title="Holidays, leave & overrides" description="Block time off, or open special hours that replace the weekly schedule for that day." />
      <form
        className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const sd = String(f.get("startDate")), ed = String(f.get("endDate") || sd);
          const startAt = allDay ? `${sd}T00:00` : `${sd}T${f.get("startTime")}`;
          const endAt = allDay ? `${ed}T23:59` : `${sd}T${f.get("endTime")}`;
          setBusy(true);
          setErr(null);
          try {
            await api("/api/availability/blocks", { body: { officerId, kind, startAt, endAt, reason: f.get("reason") } });
            (e.target as HTMLFormElement).reset();
            router.refresh();
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Type">
          <Select value={kind} onChange={(e) => { const k = e.target.value as typeof kind; setKind(k); if (k === "AVAILABLE") setAllDay(false); }}>
            <option value="UNAVAILABLE">Unavailable (holiday / leave / break)</option>
            <option value="AVAILABLE">Special availability (override)</option>
          </Select>
        </Field>
        <Field label="Date"><Input type="date" name="startDate" required /></Field>
        {allDay ? (
          <Field label="Until (optional)"><Input type="date" name="endDate" /></Field>
        ) : (
          <div className="grid grid-cols-2 gap-2 lg:col-span-1">
            <Field label="From"><Input type="time" name="startTime" required /></Field>
            <Field label="To"><Input type="time" name="endTime" required /></Field>
          </div>
        )}
        <Field label="Reason"><Input name="reason" placeholder={kind === "UNAVAILABLE" ? "e.g. Diwali holiday" : "e.g. Extra exam-week hours"} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" checked={allDay} disabled={kind === "AVAILABLE"} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 accent-brand-600" /> Full day(s)
        </label>
        <Button className="self-end" disabled={busy}>{busy ? "Adding…" : "Add"}</Button>
        {err && <div className="sm:col-span-2 lg:col-span-6"><Alert>{err}</Alert></div>}
      </form>
      {blocks.length ? (
        <ul className="divide-y divide-slate-100">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={b.kind === "UNAVAILABLE" ? "rose" : "green"}>{b.kind === "UNAVAILABLE" ? "Unavailable" : "Special hours"}</Badge>
                <span className="font-medium">{b.label}</span>
                {b.reason && <span className="text-slate-500">— {b.reason}</span>}
              </div>
              <button
                className="text-xs font-medium text-slate-400 hover:text-rose-600"
                onClick={async () => {
                  await api(`/api/availability/blocks/${b.id}`, { method: "DELETE" });
                  router.refresh();
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-slate-500">No upcoming holidays or overrides. ({timezone})</p>
      )}
    </Card>
  );
}
