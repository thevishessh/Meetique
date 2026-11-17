import Link from "next/link";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/status";
import { APP_NAME } from "@/lib/config";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const BTN = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-300",
  secondary: "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-slate-400",
  danger: "bg-white text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50 disabled:text-rose-300",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:bg-emerald-300",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
};
const SIZE = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" };

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN; size?: keyof typeof SIZE };

export function Button({ variant = "primary", size = "md", className, ...p }: ButtonProps) {
  return (
    <button
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed",
        BTN[variant],
        SIZE[size],
        className,
      )}
    />
  );
}

export function ButtonLink({ href, variant = "primary", size = "md", className, children }: { href: string; variant?: keyof typeof BTN; size?: keyof typeof SIZE; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cx("inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors", BTN[variant], SIZE[size], className)}>
      {children}
    </Link>
  );
}

const INPUT = "block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-500";

export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(INPUT, "h-10", p.className)} />;
}
export function Textarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(INPUT, p.className)} />;
}
export function Select(p: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(INPUT, "h-10 pr-8", p.className)} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx("rounded-2xl bg-white shadow-sm ring-1 ring-slate-200", className)}>{children}</div>;
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", STATUS_TONE[status])}>{STATUS_LABEL[status]}</span>;
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "brand" | "green" | "amber" | "rose" }) {
  const t = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    brand: "bg-brand-50 text-brand-700 ring-brand-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
  }[tone];
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", t)}>{children}</span>;
}

export function PageHeader({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <div className="mt-1 text-sm text-slate-500">{description}</div>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: string }) {
  return (
    <Card className="p-5">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className={cx("mt-1 text-3xl font-semibold tracking-tight", tone ?? "text-slate-900")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </Card>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Alert({ tone = "rose", children }: { tone?: "rose" | "green" | "amber" | "brand"; children: React.ReactNode }) {
  const t = {
    rose: "bg-rose-50 text-rose-800 ring-rose-200",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    amber: "bg-amber-50 text-amber-900 ring-amber-200",
    brand: "bg-brand-50 text-brand-800 ring-brand-200",
  }[tone];
  return <div className={cx("rounded-lg px-4 py-3 text-sm ring-1 ring-inset", t)}>{children}</div>;
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-semibold tracking-tight text-slate-900", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="4" width="18" height="17" rx="3" />
          <path d="M8 2v4M16 2v4M3 10h18M8 15h3" />
        </svg>
      </span>
      <span>{APP_NAME}</span>
    </span>
  );
}
