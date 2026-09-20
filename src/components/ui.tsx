import Link from "next/link";
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
