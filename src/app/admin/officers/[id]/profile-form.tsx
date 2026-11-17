"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, formData } from "@/components/client-api";
import { Alert, Button, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";

type O = { id: string; userId: string; name: string; email: string; employeeId: string | null; phone: string | null; designation: string; departmentId: string | null; location: string | null; bio: string | null; isActive: boolean; canSummon: boolean };

export function OfficerProfileForm({ officer, departments }: { officer: O; departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "green" | "rose"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "green", text: ok });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "rose", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Profile"
        description={officer.email}
        action={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                const pw = prompt("New password for this officer (min 8 characters):");
                if (pw) act(() => api(`/api/staff/${officer.userId}`, { method: "PATCH", body: { password: pw } }), "Password reset.");
              }}
            >
              Reset password
            </Button>
            <Button size="sm" variant={officer.isActive ? "danger" : "success"} disabled={busy} onClick={() => act(() => api(`/api/officers/${officer.id}`, { method: "PATCH", body: { isActive: !officer.isActive, ...(officer.isActive ? { isBookable: false } : {}) } }), officer.isActive ? "Officer deactivated." : "Officer re-activated.")}>
              {officer.isActive ? "Deactivate" : "Re-activate"}
            </Button>
          </div>
        }
      />
      <form
        className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          const d = formData(e.currentTarget);
          act(() => api(`/api/officers/${officer.id}`, { method: "PATCH", body: { ...d, departmentId: d.departmentId || null, canSummon: d.canSummon === "on" } }), "Profile saved.");
        }}
      >
        {msg && <div className="sm:col-span-2 lg:col-span-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
        <Field label="Name"><Input name="name" defaultValue={officer.name} required /></Field>
        <Field label="L Code"><Input name="employeeId" defaultValue={officer.employeeId ?? ""} required pattern="[A-Za-z0-9][A-Za-z0-9-]{1,19}" className="uppercase" /></Field>
        <Field label="Designation"><Input name="designation" defaultValue={officer.designation} required /></Field>
        <Field label="Department">
          <Select name="departmentId" defaultValue={officer.departmentId ?? ""}>
            <option value="">— None —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Phone"><Input name="phone" defaultValue={officer.phone ?? ""} /></Field>
        <Field label="Room / location"><Input name="location" defaultValue={officer.location ?? ""} /></Field>
        <Field label="Short bio" className="sm:col-span-2 lg:col-span-3"><Textarea name="bio" rows={2} defaultValue={officer.bio ?? ""} /></Field>
        <label className="flex items-start gap-3 rounded-lg bg-rose-50 px-4 py-3 text-sm ring-1 ring-inset ring-rose-200 sm:col-span-2 lg:col-span-3">
          <input type="checkbox" name="canSummon" defaultChecked={officer.canSummon} className="mt-0.5 h-4 w-4 accent-rose-600" />
          <span><b>Designated officer: can call immediate meetings</b><br /><span className="text-slate-600">Lets this officer call anyone in the university for an urgent meeting, ignoring slots and working hours.</span></span>
        </label>
        <div><Button disabled={busy}>Save profile</Button></div>
      </form>
    </Card>
  );
}
