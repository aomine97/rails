import Link from "next/link";
import { MarketingFooter, MarketingHeader } from "@/components/marketing";
import { PRICES } from "@/lib/billing/plans";
import { billingConfigured } from "@/lib/billing/stripe";
import { supabaseServer } from "@/lib/supabase/server";
import { subscriptionOf } from "@/lib/billing/entitlements";
import { saveEduEmail, startCheckout } from "./actions";

export const dynamic = "force-dynamic";

const ROWS: [string, string, string, string][] = [
  ["Matched jobs, fit scores, reasons", "Unlimited", "Unlimited", "Unlimited"],
  ["Autofill (extension) + tracker", "Unlimited", "Unlimited", "Unlimited"],
  ["AI credits: tailored resume, cover letter, mock set", "3 every 3 days", "Unlimited", "Unlimited"],
  ["Resume score", "1 full score", "Unlimited", "Unlimited"],
  ["Autopilot (prepares applications overnight)", "Preview only", "10 / night", "20 / night"],
  ["Coach", "3 messages / day", "Unlimited", "Unlimited"],
  ["Referral contacts", "1 reveal / day", "Unlimited", "Unlimited"],
  ["New-job alerts", "Daily digest", "Instant", "Instant"],
  ["“Got hired” pause", "—", "Cancel anytime", "Pauses, keeps the days"],
];

/** Plain function, not a component: server page, no state. */
function cta({ plan, label, dark, current, reason, configured, signedIn }: { plan: "pro" | "semester"; label: string; dark: boolean; current: string; reason: string; configured: boolean; signedIn: boolean }) {
  if (current === plan) return <Link href="/app/billing" className={`mt-4 block w-full rounded-lg px-3 py-2 text-center font-extrabold ${dark ? "bg-navy-2 text-white" : "bg-light text-ink"}`}>Your plan · manage</Link>;
  return (
    <form action={startCheckout}>
      <input type="hidden" name="plan" value={plan} /><input type="hidden" name="reason" value={reason} />
      <button disabled={!configured && signedIn} className={`mt-4 w-full rounded-lg px-3 py-2 font-extrabold disabled:opacity-60 ${dark ? "bg-orange text-ink" : "bg-ink text-white"}`}>{signedIn ? label : "Sign up, then " + label.toLowerCase()}</button>
    </form>
  );
}

export default async function Pricing({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  let student = false, current: string = "free", eduEmail: string | null = null;
  if (user) {
    const [{ data: prof }, sub] = await Promise.all([
      supabase.from("profiles").select("edu_verified,edu_email,email").eq("id", user.id).maybeSingle(),
      subscriptionOf(supabase, user.id),
    ]);
    student = !!prof?.edu_verified; eduEmail = prof?.edu_email ?? (prof?.edu_verified ? prof.email : null);
    if (sub && sub.status === "active" && (sub.plan === "pro" || sub.plan === "semester")) current = sub.plan;
  }
  const configured = billingConfigured();
  // A real date, set once at launch (launch + 14 days). Never a resetting timer.
  const endsRaw = process.env.LAUNCH_PRICE_ENDS;
  const launchEnds = endsRaw && !Number.isNaN(Date.parse(endsRaw)) && Date.parse(endsRaw) > new Date().getTime() ? new Date(endsRaw).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
  const pro = student ? PRICES.proMonthlyStudent : PRICES.proMonthly;
  const sem = student ? PRICES.semesterStudent : PRICES.semester;
  const reason = sp.reason ?? "";
  const note = sp.err === "not_configured" ? "Checkout is not switched on yet. Try again in a bit." : sp.err === "not_edu" ? "That does not look like a school email (.edu, .ac.xx, .edu.xx)." : sp.err === "stripe" ? "Stripe did not return a checkout page. Try again." : sp.canceled ? "Checkout canceled. Nothing was charged." : sp.student ? "Student price unlocked." : null;


  return (
    <main className="flex flex-1 flex-col bg-marketing">
      <MarketingHeader signedIn={!!user} />
      <section className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Launch pricing. Students pay less.</h1>
        {launchEnds && <p className="mt-2 inline-flex rounded-full bg-orange/15 px-3 py-1 text-[13px] font-bold text-ink">Launch prices hold until {launchEnds}. After that the anchor price is the price.</p>}
        <p className="mt-2 max-w-2xl text-text">The feed, fit scores, autofill and tracker are free forever. Paid plans remove the credit limit and turn on Autopilot and Coach. 7-day refund on every plan, no questions.</p>
        {note && <div className={`mt-4 rounded-xl border px-4 py-2 text-[13px] ${sp.err ? "border-red-chip-text/30 bg-red-chip text-red-chip-text" : "border-green-chip-text/30 bg-green-chip text-green-chip-text"}`}>{note}</div>}
        {!configured && <div className="mt-4 rounded-xl border border-amber-chip-text/30 bg-amber-chip px-4 py-2 text-[13px] text-amber-chip-text">Checkout opens as soon as Stripe is connected. Prices below are final.</div>}

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-line-strong bg-surface p-6">
            <div className="text-sm font-bold text-muted">Free</div>
            <div className="font-display text-4xl font-extrabold">$0</div>
            <p className="mt-2 text-sm text-text">Every matched job with fit scores, unlimited autofill, tracker, 3 AI credits every 3 days.</p>
            {user ? <Link href="/app" className="mt-4 block w-full rounded-lg bg-light px-3 py-2 text-center font-extrabold text-ink">{current === "free" ? "Your plan" : "Included"}</Link> : <Link href="/signup" className="mt-4 block w-full rounded-lg bg-ink px-3 py-2 text-center font-extrabold text-white">Start free</Link>}
          </div>
          <div className={`rounded-2xl p-6 ${student ? "border border-line-strong bg-surface" : "bg-ink text-white"}`}>
            <div className={`text-sm font-bold ${student ? "text-muted" : "text-orange"}`}>Rails Pro</div>
            <div className="flex items-baseline gap-2"><span className={`text-lg line-through ${student ? "text-muted" : "text-[#8A99B3]"}`}>${PRICES.anchorMonthly}</span><span className="font-display text-4xl font-extrabold">${pro}</span><span className={`text-sm ${student ? "text-muted" : "text-[#8A99B3]"}`}>/mo{student ? " student price" : ""}</span></div>
            {!student && <div className="mt-1 text-[12px] text-[#C9D3E4]">${PRICES.proMonthlyStudent}/mo with a school email</div>}
            <p className={`mt-2 text-sm ${student ? "text-text" : "text-[#C9D3E4]"}`}>Unlimited tailoring and cover letters, Autopilot every night, Coach, unlimited mock interviews, every referral contact. Cancel anytime.</p>
            {cta({ plan: "pro", label: "Start Pro", dark: !student, current, reason, configured, signedIn: !!user })}
          </div>
          <div className={`rounded-2xl p-6 ${student ? "bg-ink text-white" : "border border-line-strong bg-surface"}`}>
            <div className={`text-sm font-bold ${student ? "text-orange" : "text-muted"}`}>Semester Pass{student ? " · best for students" : ""}</div>
            <div className="flex items-baseline gap-2"><span className="font-display text-4xl font-extrabold">${sem}</span><span className={`text-sm ${student ? "text-[#8A99B3]" : "text-muted"}`}>one payment · {PRICES.semesterMonths} months{student ? " · student price" : ""}</span></div>
            {!student && <div className="mt-1 text-[12px] text-muted">${PRICES.semesterStudent} with a school email</div>}
            <p className={`mt-2 text-sm ${student ? "text-[#C9D3E4]" : "text-text"}`}>Everything in Pro for the whole recruiting season. Get hired in week 3? Pause it and keep the remaining days for next time.</p>
            {cta({ plan: "semester", label: "Get the pass", dark: student, current, reason, configured, signedIn: !!user })}
          </div>
        </div>

        {user && !student && (
          <form action={saveEduEmail} className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-4 text-[13px]">
            <div className="mr-2"><div className="font-bold text-ink">Student? Unlock the student price.</div><div className="text-muted">Enter your school email (.edu). We check the domain; a mailed code comes later.</div></div>
            <input name="edu_email" type="email" required placeholder="you@school.edu" className="min-w-[220px] flex-1 rounded-lg border border-line bg-light px-3 py-2" />
            <button className="rounded-full bg-ink px-4 py-2 font-bold text-white">Unlock</button>
          </form>
        )}
        {user && student && eduEmail && <p className="mt-4 text-[12px] text-muted">Student price applied via {eduEmail}.</p>}

        <div className="mt-10 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-line text-left text-[11px] font-bold uppercase tracking-wide text-muted"><th className="px-4 py-3">What you get</th><th className="px-4 py-3">Free</th><th className="px-4 py-3">Pro</th><th className="px-4 py-3">Semester Pass</th></tr></thead>
            <tbody>{ROWS.map((r) => <tr key={r[0]} className="border-b border-line last:border-0"><td className="px-4 py-2.5 text-ink">{r[0]}</td><td className="px-4 py-2.5 text-text">{r[1]}</td><td className="px-4 py-2.5 font-semibold text-ink">{r[2]}</td><td className="px-4 py-2.5 font-semibold text-ink">{r[3]}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="mt-6 text-[12px] text-muted">Refunds: email within 7 days of your first payment and it is returned in full. Referral: a classmate who joins with your link pays $5 for their first month of Pro, and you get a month free after their second payment. Prices in USD; tax added where required. Rails never submits an application for you. See the <Link href="/terms" className="underline">terms</Link> and <Link href="/privacy" className="underline">privacy policy</Link>.</p>
        <div id="campus" className="mt-10 rounded-2xl border border-line bg-surface p-6">
          <div className="font-display text-[20px] font-extrabold text-ink">Career Center plan</div>
          <p className="mt-1 text-[14px] text-text">Every student on your campus gets Pro; counselors get a dashboard with program-level numbers and the students who need a hand. Priced per campus. The first semester is free for our first three pilot campuses.</p>
          <Link href="/career-centers" className="mt-3 inline-flex rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-white">How it works</Link>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
