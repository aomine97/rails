import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { PRICES } from "@/lib/billing/plans";

/** Placeholder until Stripe lands: the real numbers, no checkout yet. */
export default function Pricing() {
  return (
    <main className="flex flex-1 flex-col bg-marketing">
      <header className="flex items-center justify-between px-6 py-4"><Wordmark /><Link href="/app" className="text-sm font-semibold text-ink">Back to app</Link></header>
      <section className="mx-auto w-full max-w-4xl px-6 py-10">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Launch pricing. Students pay less.</h1>
        <p className="mt-2 text-text">Checkout opens this week. Everything below is live except the button.</p>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-line-strong bg-surface p-6"><div className="text-sm font-bold text-muted">Free</div><div className="font-display text-4xl font-extrabold">$0</div><p className="mt-2 text-sm text-text">Every matched job with fit scores, unlimited autofill, tracker, 3 AI credits every 3 days.</p></div>
          <div className="rounded-2xl bg-ink p-6 text-white"><div className="text-sm font-bold text-orange">Rails Pro</div><div className="flex items-baseline gap-2"><span className="text-lg text-[#8A99B3] line-through">${PRICES.anchorMonthly}</span><span className="font-display text-4xl font-extrabold">${PRICES.proMonthlyStudent}</span><span className="text-sm text-[#8A99B3]">/mo students · ${PRICES.proMonthly} everyone else</span></div><p className="mt-2 text-sm text-[#C9D3E4]">Unlimited tailoring, Autopilot every night, Coach, unlimited mock interviews, every referral contact.</p><button disabled className="mt-4 w-full rounded-lg bg-orange px-3 py-2 font-extrabold text-ink opacity-70">Checkout coming</button></div>
          <div className="rounded-2xl border border-line-strong bg-surface p-6"><div className="text-sm font-bold text-muted">Semester Pass</div><div className="flex items-baseline gap-2"><span className="font-display text-4xl font-extrabold">${PRICES.semesterStudent}</span><span className="text-sm text-muted">students · ${PRICES.semester} everyone else · {PRICES.semesterMonths} months</span></div><p className="mt-2 text-sm text-text">Everything in Pro for the whole recruiting season, one payment.</p></div>
        </div>
      </section>
    </main>
  );
}
