import Link from "next/link";
import type { ReactNode } from "react";
import { Mark } from "./app-shell";

export function MarketingHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-marketing/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between gap-4 px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-display text-[19px] font-extrabold tracking-tight text-ink"><Mark /> Rails</Link>
        <nav className="hidden items-center gap-6 text-[14px] font-semibold text-text md:flex" aria-label="Site">
          <Link href="/#how" className="hover:text-ink">How it works</Link>
          <Link href="/#fields" className="hover:text-ink">Fields</Link>
          <Link href="/pricing" className="hover:text-ink">Pricing</Link>
          <Link href="/career-centers" className="hover:text-ink">Career centers</Link>
        </nav>
        <div className="flex items-center gap-2 text-[14px] font-bold">
          {signedIn ? (
            <Link href="/app" className="inline-flex h-10 items-center rounded-xl bg-ink px-4 text-white hover:bg-navy-2">Open Rails</Link>
          ) : (
            <>
              <Link href="/login" className="hidden h-10 items-center rounded-xl px-3 text-ink sm:inline-flex">Sign in</Link>
              <Link href="/signup" className="inline-flex h-10 items-center rounded-xl bg-orange px-4 text-ink shadow-[var(--shadow-cta)] hover:brightness-105">Join free</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-4 py-8 text-[13px] text-muted md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex items-center gap-2"><Mark size={22} /><span className="font-semibold text-ink">Rails</span><span>· Built in Northern Virginia · Not yet available in California or New York</span></div>
        <nav className="flex gap-5 font-semibold" aria-label="Legal">
          <Link href="/pricing" className="hover:text-ink">Pricing</Link>
          <Link href="/career-centers" className="hover:text-ink">Career centers</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}

/** Long-form legal/marketing text column. */
export function Prose({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-[760px] px-4 py-12 md:px-8">
      <h1 className="font-display text-[34px] font-extrabold leading-tight tracking-tight text-ink">{title}</h1>
      <p className="mt-2 text-[13px] text-muted">Last updated {updated}</p>
      <div className="prose-rails mt-8 flex flex-col gap-4 text-[15px] leading-relaxed text-text">{children}</div>
    </article>
  );
}

export function contactEmail(): string | null {
  return process.env.NEXT_PUBLIC_CONTACT_EMAIL || null;
}
