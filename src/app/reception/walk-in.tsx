"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SlotPicker from "@/components/slot-picker";
import { api, formData } from "@/components/client-api";
import { Alert, Button, Card, CardHeader, Field, Input, Select } from "@/components/ui";
import { VisitorExtraFields, type VisitorFieldConfig } from "@/components/visitor-extra-fields";

export function WalkIn({ officers, today, fields, defaultOfficerId }: { officers: { id: string; name: string }[]; today: string; fields: VisitorFieldConfig; defaultOfficerId?: string }) {
  const router = useRouter();
  const [officerId, setOfficerId] = useState(defaultOfficerId ?? "");
  const [slot, setSlot] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "rose"; text: React.ReactNode } | null>(null);
  const [busy, setBusy] = useState(false);
  const [k, setK] = useState(0);

  return (
    <Card>
      <CardHeader title="Walk-in registration" description="Register someone without a booking. They are checked in at once." />
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!slot) return setMsg({ tone: "rose", text: "Pick a slot first" });
          const form = e.currentTarget;
          setBusy(true);
          setMsg(null);
          try {
            const r = await api<{ tokenNumber: string; manageCode: string }>("/api/appointments", { body: { ...formData(form), officerId, startAt: slot, walkIn: true } });
            setMsg({ tone: "green", text: <>Token <b className="token-no">{r.tokenNumber}</b> issued. <a className="link" href={`/a/${r.manageCode}`} target="_blank">print slip</a></> });
            form.reset();
            setSlot(null);
            setK((x) => x + 1);
            router.refresh();
          } catch (e) {
            setMsg({ tone: "rose", text: (e as Error).message });
          } finally {
            setBusy(false);
          }
        }}
      >
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Field label="Officer">
          <Select value={officerId} onChange={(e) => { setOfficerId(e.target.value); setSlot(null); }} required>
            <option value="">Select officer…</option>
            {officers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </Field>
        {officerId && (
          <>
            <SlotPicker key={`${officerId}-${k}`} officerId={officerId} startDate={today} count={1} value={slot} onChange={(s) => setSlot(s)} staff />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Visitor name"><Input name="name" required /></Field>
              <Field label="Mobile"><Input name="phone" type="tel" required /></Field>
              <Field label="L Code" hint="Compulsory. Links the visit to the staff member’s account."><Input name="lCode" required pattern="[A-Za-z0-9][A-Za-z0-9-]{1,19}" placeholder="e.g. L12345" className="uppercase" /></Field>
              <VisitorExtraFields config={fields} />
              <Field label="Purpose" className="sm:col-span-2"><Input name="purpose" /></Field>
            </div>
            <Button disabled={busy || !slot}>{busy ? "Issuing…" : "Issue token & check in"}</Button>
          </>
        )}
      </form>
    </Card>
  );
}
