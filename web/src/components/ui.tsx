import { AlertTriangle, Check, CircleHelp, CircleSlash, Contrast, Loader2, Pencil } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { ApiError, type Group } from "../lib/api";
import { GROUPS, type GroupIcon } from "../lib/groups";

/* ---------- buttons ---------- */

type Variant = "primary" | "secondary" | "ghost";
const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[15px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "bg-blue text-white hover:bg-blue-ink",
  secondary: "border border-line-strong bg-surface text-ink hover:border-blue hover:text-blue-ink",
  ghost: "text-ink-2 hover:bg-surface-2",
};

export function Button({ variant = "primary", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}

export function ButtonLink({ variant = "primary", className = "", ...rest }: LinkProps & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}

/* ---------- states ---------- */

export function Loading({ what }: { what: string }) {
  return (
    <p className="flex items-center gap-2 py-12 text-muted" aria-live="polite">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading {what}…
    </p>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof ApiError ? error.message : "Something went wrong. Check that the LearnLoop server is running.";
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-gb/30 bg-gb-soft px-4 py-3 text-[15px] text-ink">
      <AlertTriangle className="size-4 shrink-0 text-gb" aria-hidden="true" />
      <span className="flex-1">{msg}</span>
      {onRetry && (
        <Button variant="secondary" className="py-1.5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-[15px] text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- answer group badge ---------- */

const ICONS: Record<GroupIcon, typeof Check> = {
  check: Check,
  alert: AlertTriangle,
  pencil: Pencil,
  half: Contrast,
  question: CircleHelp,
  off: CircleSlash,
};

export function GroupBadge({ group, size = "sm" }: { group: Group; size?: "sm" | "lg" }) {
  const g = GROUPS[group];
  const Icon = ICONS[g.icon];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${size === "lg" ? "px-3 py-1 text-[15px]" : "px-2.5 py-0.5 text-[13px]"}`}
      style={{ color: g.color, background: g.soft }}
    >
      <Icon className={size === "lg" ? "size-4" : "size-3.5"} aria-hidden="true" />
      {size === "lg" ? g.label : g.short}
    </span>
  );
}

/* ---------- small layout helpers ---------- */

export function PageHeader({ title, children, aside }: { title: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6 pt-8">
      <div className="max-w-2xl">
        <h1 className="text-[28px] font-semibold leading-tight sm:text-[32px]">{title}</h1>
        {children && <p className="mt-2 text-[16px] text-muted">{children}</p>}
      </div>
      {aside}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-surface ${className}`}>{children}</section>;
}
