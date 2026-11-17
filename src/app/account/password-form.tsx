"use client";
import { useState } from "react";
import { api, formData } from "@/components/client-api";
import { Alert, Button, Field, Input } from "@/components/ui";

export function PasswordForm() {
  const [msg, setMsg] = useState<{ tone: "green" | "rose"; text: string } | null>(null);
  return (
    <form
      className="space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const d = formData(form);
        if (d.newPassword !== d.confirm) return setMsg({ tone: "rose", text: "New passwords do not match" });
        try {
          await api("/api/auth/password", { body: { currentPassword: d.currentPassword, newPassword: d.newPassword } });
          form.reset();
          setMsg({ tone: "green", text: "Password changed." });
        } catch (e) {
          setMsg({ tone: "rose", text: (e as Error).message });
        }
      }}
    >
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Field label="Current password"><Input name="currentPassword" type="password" required autoComplete="current-password" /></Field>
      <Field label="New password" hint="At least 8 characters"><Input name="newPassword" type="password" required minLength={8} autoComplete="new-password" /></Field>
      <Field label="Confirm new password"><Input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></Field>
      <Button>Change password</Button>
    </form>
  );
}
