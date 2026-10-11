import {
  AlertTriangle, Check, CircleHelp, CircleSlash, Contrast, Gauge, Loader2, Magnet, MoveHorizontal, Pencil, Search, Star, Timer, Waves, Zap,
} from "lucide-react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { ApiError, type Group } from "../lib/api";
import { GROUPS, type GroupIcon } from "../lib/groups";

/* ---------- buttons ---------- */

type Variant = "primary" | "secondary" | "ghost";
const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-bold transition-[background-color,border-color,color,transform,box-shadow] active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "bg-blue text-white shadow-[0_3px_0_var(--ll-blue-ink)] hover:bg-blue-ink active:shadow-none",
  secondary: "border-2 border-line bg-surface text-ink hover:border-blue hover:text-blue-ink",
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
      className={`inline-flex items-center gap-1.5 rounded-full font-bold ${size === "lg" ? "px-3.5 py-1 text-[15px]" : "px-2.5 py-0.5 text-[13px]"}`}
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
        <h1 className="text-[28px] font-extrabold leading-tight sm:text-[34px]">{title}</h1>
        {children && <p className="mt-2 text-[16px] text-muted">{children}</p>}
      </div>
      {aside}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface shadow-[0_2px_0_var(--ll-line)] ${className}`}>{children}</section>;
}

/* ---------- friendly touches ---------- */

const CONCEPT_LOOK: Record<string, { icon: typeof Check; color: string; soft: string }> = {
  C1: { icon: MoveHorizontal, color: "var(--ll-blue)", soft: "var(--ll-blue-soft)" },
  C2: { icon: Gauge, color: "var(--ll-coral)", soft: "var(--ll-coral-soft)" },
  C3: { icon: Timer, color: "var(--ll-grape)", soft: "var(--ll-grape-soft)" },
  C4: { icon: Magnet, color: "var(--ll-mint)", soft: "var(--ll-mint-soft)" },
  C5: { icon: Zap, color: "var(--ll-sun)", soft: "var(--ll-sun-soft)" },
  C6: { icon: Waves, color: "var(--ll-teal)", soft: "var(--ll-teal-soft)" },
  C7: { icon: Search, color: "var(--ll-coral)", soft: "var(--ll-coral-soft)" },
};

/** A coloured icon tile, so each concept is easy to spot. */
export function ConceptTile({ id, size = "md" }: { id: string; size?: "sm" | "md" | "lg" }) {
  const look = CONCEPT_LOOK[id] ?? CONCEPT_LOOK.C1;
  const Icon = look.icon;
  const box = { sm: "size-9 rounded-xl", md: "size-11 rounded-2xl", lg: "size-14 rounded-2xl" }[size];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${box}`} style={{ background: look.soft, color: look.color }} aria-hidden="true">
      <Icon className={size === "lg" ? "size-7" : size === "md" ? "size-5.5" : "size-4.5"} strokeWidth={2.2} />
    </span>
  );
}

/** Progress as 0–3 stars (from the mastery status step), always with a text label next to it. */
export function Stars({ step, label, size = "md" }: { step: number; label: string; size?: "sm" | "md" }) {
  const icon = size === "sm" ? "size-3.5" : "size-4.5";
  return (
    <span className="inline-flex items-center gap-2" aria-label={`Progress: ${label}`}>
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((s) => (
          <Star key={s} className={icon} strokeWidth={2} style={s <= step ? { color: "var(--ll-sun)", fill: "var(--ll-sun)" } : { color: "var(--ll-line-strong)" }} />
        ))}
      </span>
      <span className={`${size === "sm" ? "text-[13px]" : "text-[13.5px]"} font-semibold text-muted`}>{label}</span>
    </span>
  );
}

const CONFETTI = ["var(--ll-blue)", "var(--ll-sun)", "var(--ll-coral)", "var(--ll-mint)", "var(--ll-grape)"];

/** A one-off burst for right answers. Decorative only; hidden when the learner prefers reduced motion. */
export function Confetti() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute left-12 top-8">
      {Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * 2 * Math.PI;
        const d = 60 + (i % 4) * 28;
        const style = { background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 5) * 25}ms`,
          "--dx": `${Math.cos(a) * d}px`, "--dy": `${Math.sin(a) * d - 30}px`, "--rot": `${(i % 2 ? 1 : -1) * (360 + i * 20)}deg` } as CSSProperties;
        return <span key={i} className="confetti" style={style} />;
      })}
    </span>
  );
}
