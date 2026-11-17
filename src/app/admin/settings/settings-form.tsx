"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, formData } from "@/components/client-api";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

export function SettingsForm({ org, timezones }: { org: { name: string; timezone: string; email: string | null; phone: string | null; address: string | null }; timezones: string[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "green" | "rose"; text: string } | null>(null);
  return (
    <form
      className="grid gap-4 p-5 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg(null);
        try {
          await api("/api/organizations/current", { method: "PATCH", body: formData(e.currentTarget) });
          setMsg({ tone: "green", text: "Settings saved." });
          router.refresh();
        } catch (e) {
          setMsg({ tone: "rose", text: (e as Error).message });
        }
      }}
    >
      {msg && <div className="sm:col-span-2"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <Field label="Organization name"><Input name="name" defaultValue={org.name} required /></Field>
      <Field label="Timezone" hint="All slot times are shown in this timezone">
        <Select name="timezone" defaultValue={org.timezone}>{timezones.map((t) => <option key={t}>{t}</option>)}</Select>
      </Field>
      <Field label="Contact email"><Input name="email" type="email" defaultValue={org.email ?? ""} /></Field>
      <Field label="Contact phone"><Input name="phone" defaultValue={org.phone ?? ""} /></Field>
      <Field label="Address" className="sm:col-span-2"><Textarea name="address" rows={2} defaultValue={org.address ?? ""} /></Field>
      <div><Button>Save settings</Button></div>
    </form>
  );
}
