import Link from "next/link";
import { Wordmark } from "@/components/ui";

/** Interim landing. The full page from the mockup is the Week 4 item; this just points at signup. */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col bg-marketing">
      <header className="flex items-center justify-between px-6 py-4">
        <Wordmark />
        <nav className="flex items-center gap-3 text-sm font-semibold">
          <Link href="/login" className="text-ink">Sign in</Link>
          <Link href="/signup" className="rounded-full bg-orange px-4 py-2 text-ink">Join free</Link>
        </nav>
      </header>
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 pb-24">
        <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-ink">Apply to ten jobs a day, properly.</h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-text">Tech jobs, anywhere in the US, for students and early-career engineers without a big-name school on the resume. Matched jobs with a real fit score, a resume tailored per posting, every form filled in seconds. You click Submit.</p>
        <div className="mt-8 flex items-center gap-4">
          <Link href="/signup" className="rounded-full bg-orange px-6 py-3 text-base font-extrabold text-ink">Join free</Link>
          <span className="text-sm text-muted">Students: $15/mo after the free tier. No card to start.</span>
        </div>
      </section>
      <footer className="px-6 py-5 text-xs text-muted">Rails · Not yet available in CA or NY</footer>
    </main>
  );
}
