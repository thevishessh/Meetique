import Link from "next/link";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/status";
import { APP_NAME } from "@/lib/config";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* Ink controls: the classes live in globals.css (.btn, .field, .tag, .ruled, .well, .note) */

const BTN = { primary: "btn--primary", secondary: "", danger: "btn--danger", success: "btn--accent", ghost: "btn--ghost" };
const SIZE = { sm: "btn--sm", md: "", lg: "btn--lg" };

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN; size?: keyof typeof SIZE };

export function Button({ variant = "primary", size = "md", className, type, ...p }: ButtonProps) {
  return <button type={type ?? "submit"} {...p} className={cx("btn", BTN[variant], SIZE[size], className)} />;
}

export function ButtonLink({ href, variant = "primary", size = "md", className, children }: { href: string; variant?: keyof typeof BTN; size?: keyof typeof SIZE; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cx("btn", BTN[variant], SIZE[size], className)}>
      {children}
    </Link>
  );
}

export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx("field", p.className)} />;
}
export function Textarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx("field", p.className)} />;
}
export function Select(p: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx("field", p.className)} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx("block min-w-0", className)}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** A section of a screen. Plain paper by default (the list inside is ruled); `well` for a panel that groups a form */
export function Card({ className, children, well }: { className?: string; children: React.ReactNode; well?: boolean }) {
  return <section className={cx("min-w-0", well && "well", className)}>{children}</section>;
}

/** Section head: the title and one line, the ink rule under it opens the list or form below */
export function CardHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink px-5 pb-3 pt-1">
      <div className="min-w-0">
        <h2 className="text-section text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={cx("tag", STATUS_TONE[status])}>{STATUS_LABEL[status]}</span>;
}

/** Tags carry state and nothing else: in (teal), out (outline), on (ink), wait (ink outline) */
export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "brand" | "green" | "amber" | "rose" }) {
  const t = { slate: "", brand: "tag--in", green: "tag--in", amber: "tag--wait", rose: "tag--on" }[tone];
  return <span className={cx("tag", t)}>{children}</span>;
}

export function PageHeader({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-display text-ink">{title}</h1>
        {description && <div className="mt-2 text-sm text-muted">{description}</div>}
      </div>
      {action}
    </div>
  );
}

/** Figures in plain black on one well, parted by hairlines; `in` marks the one that means open */
export function Stats({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cx("well grid grid-cols-2 divide-rule sm:flex sm:divide-x", className)}>{children}</dl>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "in" }) {
  return (
    <div className="min-w-0 flex-1 px-5 py-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={cx("num mt-1 font-display text-3xl font-bold tracking-[var(--tracking-display)]", tone === "in" ? "text-accent" : "text-ink")}>{value}</dd>
      {hint && <dd className="mt-1 text-xs text-muted">{hint}</dd>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="px-5 py-8">
      <p className="text-md font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Alert({ tone = "rose", children }: { tone?: "rose" | "green" | "amber" | "brand"; children: React.ReactNode }) {
  const t = { rose: "note--error", green: "note--in", amber: "note--strong", brand: "" }[tone];
  return (
    <div role={tone === "rose" ? "alert" : "status"} className={cx("note", t)}>
      {children}
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return <span className={cx("font-display text-lg font-bold tracking-[var(--tracking-display)] text-ink", className)}>{APP_NAME}</span>;
}
