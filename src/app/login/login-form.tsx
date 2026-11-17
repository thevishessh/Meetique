"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, formData } from "@/components/client-api";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function LoginForm() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          const r = await api<{ redirect: string }>("/api/auth/login", { body: formData(e.currentTarget) });
          router.replace(r.redirect);
          router.refresh();
        } catch (e) {
          setErr((e as Error).message);
          setBusy(false);
        }
      }}
    >
      {err && <Alert>{err}</Alert>}
      <Field label="Email"><Input name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password"><Input name="password" type="password" autoComplete="current-password" required /></Field>
      <Button className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}
