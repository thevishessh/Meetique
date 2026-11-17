"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, formData } from "./client-api";
import { Alert, Button, Field, Input } from "./ui";

const HINT = "At least 8 characters, with a letter and a number";

/** First sign-in / admin reset: user must replace the temporary password */
export function ForceChangeForm({ home }: { home: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const d = formData(e.currentTarget);
        if (d.newPassword !== d.confirm) return setErr("New passwords do not match");
        setBusy(true);
        setErr(null);
        try {
          await api("/api/auth/password", { body: { currentPassword: d.currentPassword, newPassword: d.newPassword } });
          router.replace(home);
          router.refresh();
        } catch (e) {
          setErr((e as Error).message);
          setBusy(false);
        }
      }}
    >
      {err && <Alert>{err}</Alert>}
      <Field label="Temporary password (the one you just used)"><Input name="currentPassword" type="password" required autoComplete="current-password" /></Field>
      <Field label="New password" hint={HINT}><Input name="newPassword" type="password" required minLength={8} autoComplete="new-password" /></Field>
      <Field label="Confirm new password"><Input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></Field>
      <Button className="w-full" disabled={busy}>{busy ? "Saving…" : "Set password & continue"}</Button>
    </form>
  );
}

export function ForgotForm() {
  const [msg, setMsg] = useState<{ text: string; devLink?: string } | null>(null);
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
          const r = await api<{ message: string; devLink?: string }>("/api/auth/forgot", { body: formData(e.currentTarget) });
          setMsg({ text: r.message, devLink: r.devLink });
        } catch (e) {
          setErr((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {err && <Alert>{err}</Alert>}
      {msg ? (
        <Alert tone="green">
          {msg.text}
          {msg.devLink && (
            <div className="mt-2 text-xs">
              <b>Development mode</b> (email not configured): <Link className="break-all underline" href={msg.devLink.replace(/^https?:\/\/[^/]+/, "")}>open reset link</Link>
            </div>
          )}
        </Alert>
      ) : (
        <>
          <Field label="Your account email"><Input name="email" type="email" required autoComplete="email" /></Field>
          <Button className="w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
        </>
      )}
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (done)
    return (
      <div className="mt-6 space-y-4">
        <Alert tone="green">Your password has been changed. You can sign in now.</Alert>
        <Button className="w-full" onClick={() => router.replace("/login")}>Go to sign in</Button>
      </div>
    );
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const d = formData(e.currentTarget);
        if (d.password !== d.confirm) return setErr("Passwords do not match");
        setBusy(true);
        setErr(null);
        try {
          await api("/api/auth/reset", { body: { token, password: d.password } });
          setDone(true);
        } catch (e) {
          setErr((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {err && <Alert>{err}</Alert>}
      <Field label="New password" hint={HINT}><Input name="password" type="password" required minLength={8} autoComplete="new-password" /></Field>
      <Field label="Confirm new password"><Input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></Field>
      <Button className="w-full" disabled={busy}>{busy ? "Saving…" : "Set new password"}</Button>
    </form>
  );
}
