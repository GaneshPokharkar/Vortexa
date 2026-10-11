import type { ReactNode } from "react";
import { ApiError } from "../lib/api";

export function ErrorNote({ error }: { error: unknown }) {
  const msg = error instanceof ApiError ? error.message : "Something went wrong loading this page.";
  return (
    <p role="alert" className="rounded-lg border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-text">
      {msg}
    </p>
  );
}

export function Loading({ what }: { what: string }) {
  return <p className="py-10 text-muted" aria-live="polite">Loading {what}…</p>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-panel ${className}`}>{children}</section>;
}

export const btnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-teal px-4 py-2.5 font-medium text-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40";
export const btnQuiet =
  "inline-flex items-center justify-center rounded-lg border border-line px-4 py-2.5 text-text transition hover:border-muted";
