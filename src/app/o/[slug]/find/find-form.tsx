"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, formData } from "@/components/client-api";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function FindForm({ org }: { org: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          const r = await api<{ manageCode: string }>("/api/lookup", { body: { ...formData(e.currentTarget), org } });
          router.push(`/a/${r.manageCode}`);
        } catch (e) {
          setErr((e as Error).message);
          setBusy(false);
        }
      }}
    >
      {err && <Alert>{err}</Alert>}
      <Field label="Token number"><Input name="token" required placeholder="ABC-2026-000124" className="uppercase" /></Field>
      <Field label="Mobile number"><Input name="phone" type="tel" required /></Field>
      <Button className="w-full" disabled={busy}>{busy ? "Searching…" : "Find booking"}</Button>
    </form>
  );
}
