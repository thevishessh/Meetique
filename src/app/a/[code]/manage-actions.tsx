"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SlotPicker from "@/components/slot-picker";
import { api } from "@/components/client-api";
import { Alert, Button, ButtonLink, Card } from "@/components/ui";

export default function ManageActions({ id, code, canChange, officerId, startDate, slug }: { id: string; code: string; canChange: boolean; officerId: string; startDate: string; slug: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reschedule" | "cancel">("idle");
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="no-print mt-6 space-y-4">
      {msg && <Alert tone="green">{msg}</Alert>}
      {err && <Alert>{err}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => window.print()}>Print / Save PDF</Button>
        {canChange && mode === "idle" && (
          <>
            <Button variant="secondary" onClick={() => { setMode("reschedule"); setErr(null); setMsg(null); }}>Reschedule</Button>
            <Button variant="danger" onClick={() => { setMode("cancel"); setErr(null); setMsg(null); }}>Cancel appointment</Button>
          </>
        )}
        {!canChange && <ButtonLink href={`/o/${slug}`} variant="secondary">Book another appointment</ButtonLink>}
      </div>

      {mode === "cancel" && (
        <Card className="p-5">
          <p className="text-sm text-slate-700">Cancel this appointment? The slot will be released for others and your token will stop working.</p>
          <div className="mt-4 flex gap-2">
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/api/appointments/${id}/cancel`, { body: { code } });
                  setMode("idle");
                  setMsg("Your appointment has been cancelled.");
                  router.refresh();
                } catch (e) {
                  setErr((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Cancelling…" : "Yes, cancel"}
            </Button>
            <Button variant="ghost" onClick={() => setMode("idle")}>Keep it</Button>
          </div>
        </Card>
      )}

      {mode === "reschedule" && (
        <Card className="p-5">
          <h3 className="mb-4 font-semibold">Pick a new time</h3>
          <SlotPicker officerId={officerId} startDate={startDate} value={slot} onChange={(s) => setSlot(s)} ignore={id} />
          <div className="mt-4 flex gap-2">
            <Button
              disabled={!slot || busy}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                try {
                  await api(`/api/appointments/${id}`, { method: "PATCH", body: { code, startAt: slot } });
                  setMode("idle");
                  setSlot(null);
                  setMsg("Rescheduled. Your token number and QR code stay the same.");
                  router.refresh();
                } catch (e) {
                  setErr((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving…" : "Confirm new time"}
            </Button>
            <Button variant="ghost" onClick={() => setMode("idle")}>Back</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
