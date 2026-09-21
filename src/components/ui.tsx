import Link from "next/link";
import type React from "react";
import type { ReactNode } from "react";

export function Wordmark({ dark = false }: { dark?: boolean }) {
  return <Link href="/" className={`font-display text-xl font-extrabold tracking-tight ${dark ? "text-white" : "text-ink"}`}>Rails</Link>;
}

export function Field({ label, name, type = "text", error, placeholder, autoComplete, defaultValue, children }: {
  label: string; name: string; type?: string; error?: string; placeholder?: string; autoComplete?: string; defaultValue?: string; children?: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold text-ink">{label}</span>
      {children ?? (
        <input name={name} type={type} placeholder={placeholder} autoComplete={autoComplete} defaultValue={defaultValue}
          aria-invalid={!!error}
          className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-[15px] text-ink outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 aria-[invalid=true]:border-red" />
      )}
      {error && <span className="text-xs font-medium text-red">{error}</span>}
    </label>
  );
}

/** Buttons by importance, not by HTML. Primary = the one orange action on the screen. */
const BTN = {
  primary: "bg-orange text-ink shadow-[var(--shadow-cta)] hover:brightness-105",
  secondary: "bg-ink text-white hover:bg-navy-2",
  ghost: "border border-line bg-surface text-ink hover:border-ink",
  quiet: "text-muted hover:text-ink",
} as const;
const BTN_SIZE = { sm: "h-9 px-3.5 text-[13px] rounded-[10px]", md: "h-10 px-4 text-[14px] rounded-xl", lg: "h-12 px-6 text-[15px] rounded-xl" } as const;
export function btn(kind: keyof typeof BTN = "ghost", size: keyof typeof BTN_SIZE = "md", extra = "") {
  return `inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold ${BTN[kind]} ${BTN_SIZE[size]} disabled:opacity-50 disabled:shadow-none ${extra}`;
}
export function Button({ kind = "ghost", size = "md", className = "", href, ...rest }: { kind?: keyof typeof BTN; size?: keyof typeof BTN_SIZE; className?: string; href?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  if (href) return <Link href={href} className={btn(kind, size, className)}>{rest.children}</Link>;
  return <button {...rest} className={btn(kind, size, className)} />;
}

const CHIP = { neutral: "bg-g2 text-g8", info: "bg-blue-chip text-blue-chip-text", good: "bg-green-chip text-green-chip-text", warn: "bg-amber-chip text-amber-chip-text", bad: "bg-red-chip text-red-chip-text", ink: "bg-ink text-white" } as const;
export function Chip({ tone = "neutral", children, className = "" }: { tone?: keyof typeof CHIP; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-semibold leading-5 ${CHIP[tone]} ${className}`}>{children}</span>;
}

export function Card({ children, className = "", pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <div className={`rounded-2xl border border-line bg-surface shadow-[var(--shadow-sm)] ${pad ? "p-5" : ""} ${className}`}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-[15px] font-extrabold tracking-tight text-ink">{children}</h2>{right}</div>;
}

export function PageHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pb-5">
      <div><h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-ink">{title}</h1>{sub && <p className="mt-1 text-[14px] text-muted">{sub}</p>}</div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) { return <div className={`skeleton ${className}`} aria-hidden="true" />; }

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-g2 text-g6"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M4 12h10M4 18h7" /></svg></div>
      <div className="font-display text-[17px] font-extrabold text-ink">{title}</div>
      <p className="mx-auto mt-1 max-w-md text-[14px] leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function PrimaryButton({ children, pending, kind = "orange" }: { children: ReactNode; pending?: boolean; kind?: "orange" | "blue" }) {
  const cls = kind === "orange" ? "bg-orange text-ink" : "bg-blue text-white";
  return (
    <button type="submit" disabled={pending} className={`h-11 rounded-lg px-4 text-[15px] font-extrabold ${cls} disabled:opacity-60`}>
      {pending ? "One moment…" : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  return message ? <p className="rounded-lg bg-red-chip px-3 py-2 text-sm font-medium text-red-chip-text">{message}</p> : null;
}

export function AuthShell({ title, sub, children, footer }: { title: string; sub: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-marketing px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-7 shadow-[0_10px_30px_rgba(11,27,58,0.08)]">
        <Wordmark />
        <h1 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-[15px] leading-relaxed text-text">{sub}</p>
        <div className="mt-6">{children}</div>
        <div className="mt-6 border-t border-line pt-4 text-sm text-muted">{footer}</div>
      </div>
    </main>
  );
}

export function GoogleButton({ next }: { next?: string }) {
  return (
    <div className="flex h-11 items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface text-[15px] font-semibold text-ink">
      <input type="hidden" name="next" value={next ?? "/app"} />
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.4 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.2 0 11.6-2 15.4-5.6l-7.5-5.8c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.7-3.9-13.6-9.5l-7.8 6C6.5 42.6 14.6 48 24 48z"/></svg>
      <button type="submit" className="font-semibold">Continue with Google</button>
    </div>
  );
}
