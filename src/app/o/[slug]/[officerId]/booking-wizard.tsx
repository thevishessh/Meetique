"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import SlotPicker from "@/components/slot-picker";
import { api, formData } from "@/components/client-api";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";

export default function BookingWizard({ officerId, startDate, days, duration }: { officerId: string; startDate: string; days: { date: string; open: number }[]; duration: number }) {
  const router = useRouter();
  const [slot, setSlot] = useState<{ start: string; label: string; date: string } | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_18rem]">
      <Card className="min-w-0 p-5 sm:p-6">
        {step === 1 ? (
          <>
            <h2 className="font-semibold">1. Choose date & time</h2>
            <p className="mb-4 text-sm text-slate-500">Only available slots can be selected. Each meeting is {duration} minutes.</p>
            <SlotPicker
              key={pickerKey}
              officerId={officerId}
              startDate={startDate}
              days={days}
              value={slot?.start ?? null}
              onChange={(start, label, date) => setSlot(start ? { start, label: label!, date: date! } : null)}
            />
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!slot) return;
              setBusy(true);
              setErr(null);
              try {
                const r = await api<{ manageCode: string }>("/api/appointments", { body: { ...formData(e.currentTarget), officerId, startAt: slot.start } });
                router.push(`/a/${r.manageCode}?new=1`);
              } catch (e) {
                const msg = (e as Error).message;
                setErr(msg);
                setBusy(false);
                if (/booked|full|passed|notice/i.test(msg)) {
                  // Slot got taken — send the visitor back to pick another
                  setSlot(null);
                  setPickerKey((k) => k + 1);
                  setStep(1);
                }
              }
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">2. Your details</h2>
              <button type="button" className="text-sm text-brand-600 hover:underline" onClick={() => setStep(1)}>← Change time</button>
            </div>
            {err && <Alert>{err}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" className="sm:col-span-2"><Input name="name" required minLength={2} autoComplete="name" /></Field>
              <Field label="Mobile number" hint="Used to find your booking later"><Input name="phone" type="tel" required inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" /></Field>
              <Field label="Email (optional)" hint="We'll email your token"><Input name="email" type="email" autoComplete="email" /></Field>
              <Field label="Purpose of visit" className="sm:col-span-2"><Textarea name="purpose" rows={3} maxLength={300} placeholder="e.g. Transcript verification" /></Field>
            </div>
            <Button size="lg" className="w-full" disabled={busy}>{busy ? "Confirming…" : "Confirm booking"}</Button>
          </form>
        )}
        {step === 1 && err && <div className="mt-4"><Alert>{err}</Alert></div>}
      </Card>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700">Your selection</h3>
          {slot ? (
            <div className="mt-3">
              <div className="text-lg font-semibold">{slot.label}</div>
              <div className="text-sm text-slate-600">{DateTime.fromISO(slot.date).toFormat("cccc, d LLLL yyyy")}</div>
              <div className="text-xs text-slate-500">{duration} minutes</div>
              {step === 1 && (
                <Button className="mt-4 w-full" onClick={() => { setErr(null); setStep(2); }}>Continue</Button>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Pick a slot to continue.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
