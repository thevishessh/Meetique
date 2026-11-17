"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, formData } from "@/components/client-api";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const code = (s: string) => s.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

export default function RegisterForm({ timezones }: { timezones: string[] }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [short, setShort] = useState("");
  const [touched, setTouched] = useState({ slug: false, short: false });

  return (
    <form
      className="mt-6 grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          const r = await api<{ redirect: string }>("/api/organizations", { body: formData(e.currentTarget) });
          router.replace(r.redirect);
          router.refresh();
        } catch (e) {
          setErr((e as Error).message);
          setBusy(false);
        }
      }}
    >
      {err && <div className="sm:col-span-2"><Alert>{err}</Alert></div>}
      <Field label="Organization name" className="sm:col-span-2">
        <Input
          name="orgName"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!touched.slug) setSlug(slugify(e.target.value));
            if (!touched.short) setShort(code(e.target.value) || "");
          }}
          placeholder="ABC University"
        />
      </Field>
      <Field label="Booking URL" hint={`/o/${slug || "your-org"}`}>
        <Input name="slug" required value={slug} onChange={(e) => { setTouched((t) => ({ ...t, slug: true })); setSlug(slugify(e.target.value)); }} />
      </Field>
      <Field label="Token short code" hint={`Tokens look like ${short || "ABC"}-${new Date().getFullYear()}-000001`}>
        <Input name="shortCode" required maxLength={6} value={short} onChange={(e) => { setTouched((t) => ({ ...t, short: true })); setShort(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); }} />
      </Field>
      <Field label="Timezone" className="sm:col-span-2">
        <Select name="timezone" defaultValue="Asia/Kolkata">
          {timezones.map((t) => <option key={t}>{t}</option>)}
        </Select>
      </Field>
      <div className="sm:col-span-2 mt-2 border-t border-slate-100 pt-4 text-sm font-semibold text-slate-700">Admin account</div>
      <Field label="Your name"><Input name="adminName" required autoComplete="name" /></Field>
      <Field label="Email"><Input name="email" type="email" required autoComplete="email" /></Field>
      <Field label="Password" hint="At least 8 characters" className="sm:col-span-2"><Input name="password" type="password" required minLength={8} autoComplete="new-password" /></Field>
      <Button className="sm:col-span-2" size="lg" disabled={busy}>{busy ? "Creating…" : "Create organization"}</Button>
    </form>
  );
}
