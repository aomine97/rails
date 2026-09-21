import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { LIMITS, PRICES } from "@/lib/billing/plans";
import { refundEligible, subscriptionOf } from "@/lib/billing/entitlements";
import { refillLabel } from "@/lib/billing/entitlements";
import { gotHired, openPortal, resumePass } from "@/app/pricing/actions";

export const dynamic = "force-dynamic";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/billing");
  const [{ data: profile }, sub, { data: credits }, { data: events }] = await Promise.all([
    supabase.from("profiles").select("full_name,edu_verified,edu_email,email").eq("id", user.id).single(),
    subscriptionOf(supabase, user.id),
    supabase.from("credits").select("balance,refill_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("billing_events").select("kind,plan,created_at,payload").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
  ]);
  const plan = sub && sub.status !== "canceled" && (sub.plan === "pro" || sub.plan === "semester" || sub.plan === "campus") && (!sub.current_period_end || new Date(sub.current_period_end) > new Date()) ? sub.plan : "free";
  const paused = sub?.status === "paused";
  const student = !!profile?.edu_verified;
  const lim = LIMITS[plan];
  const price = plan === "pro" ? (student ? PRICES.proMonthlyStudent : PRICES.proMonthly) : plan === "semester" ? (student ? PRICES.semesterStudent : PRICES.semester) : 0;
  const refund = refundEligible(sub?.started_at ?? null);

  return (
    <AppShell active="/app/billing" name={profile?.full_name} credits={plan === "free" ? credits?.balance ?? 3 : null}>
      <div className="max-w-[860px] pb-10">
        <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-ink">Billing</h1>
        {sp.welcome && <div className="mt-4 rounded-xl border border-green-chip-text/30 bg-green-chip px-4 py-3 text-[13px] text-green-chip-text"><span className="font-bold">You are on {plan === "free" ? "your way" : plan === "pro" ? "Rails Pro" : "the Semester Pass"}.</span> {plan === "free" ? "Stripe is confirming the payment; this page updates within a minute." : "Credits are unlimited now. Go tailor something."}</div>}
        {sp.hired && <div className="mt-4 rounded-xl border border-green-chip-text/30 bg-green-chip px-4 py-3 text-[13px] text-green-chip-text"><span className="font-bold">Congratulations.</span> {plan === "pro" ? "Pro stays on until the end of this period and does not renew." : "Your pass is paused; the remaining days are kept for when you need them."}</div>}

        <section className="mt-6 rounded-2xl border border-line bg-surface p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Current plan</div>
              <div className="font-display text-3xl font-extrabold tracking-tight">{plan === "free" ? "Free" : plan === "pro" ? "Rails Pro" : plan === "semester" ? "Semester Pass" : "Campus (Career Center)"}{paused ? " · paused" : ""}</div>
              <div className="mt-1 text-[13px] text-text">
                {plan === "free" && <>3 AI credits every 3 days. {credits ? <>Balance <span className="font-bold text-ink">{credits.balance}</span>{credits.refill_at && credits.balance < 3 ? <>, refills in {refillLabel(credits.refill_at)}</> : null}.</> : null}</>}
                {plan === "pro" && <>${price}/mo{student ? " (student price)" : ""}. {sub?.cancel_at ? <>Ends {fmt(sub.cancel_at)}, does not renew.</> : <>Renews {fmt(sub?.current_period_end ?? null)}.</>}</>}
                {plan === "semester" && <>${price} one payment{student ? " (student price)" : ""}. {paused ? "Paused." : <>Runs until {fmt(sub?.current_period_end ?? null)}.</>}</>}
                {plan === "campus" && <>Paid by your career center. Everything unlocked.</>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {plan === "free" && <Link href="/pricing" className="rounded-full bg-orange px-4 py-2 text-[13px] font-extrabold text-ink">Upgrade · ${student ? PRICES.proMonthlyStudent : PRICES.proMonthly}/mo</Link>}
              {(plan === "pro" || (plan === "semester" && sub?.stripe_customer_id)) && <form action={openPortal}><button className="rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-bold text-ink">Manage billing, invoices, card</button></form>}
              {plan === "pro" && !sub?.cancel_at && <form action={gotHired}><button className="text-[12px] font-semibold text-muted hover:text-ink">I got hired: stop renewing</button></form>}
              {plan === "semester" && !paused && <form action={gotHired}><button className="text-[12px] font-semibold text-muted hover:text-ink">I got hired: pause the pass</button></form>}
              {paused && <form action={resumePass}><button className="rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-white">Resume the pass</button></form>}
            </div>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
            {[["AI credits", lim.aiCredits === "unlimited" ? "Unlimited" : `${lim.aiCredits} / 3 days`], ["Autopilot", lim.autopilotPerNight ? `${lim.autopilotPerNight} / night` : "Preview"], ["Coach", lim.coachMessagesPerDay === "unlimited" ? "Unlimited" : `${lim.coachMessagesPerDay} / day`], ["Alerts", lim.instantAlerts ? "Instant" : "Daily digest"]].map(([k, v]) => (
              <li key={k} className="rounded-lg border border-line bg-light px-3 py-2"><div className="text-[10px] font-bold uppercase tracking-wide text-muted">{k}</div><div className="font-semibold text-ink">{v}</div></li>
            ))}
          </ul>
        </section>

        <section className="mt-4 rounded-2xl border border-line bg-surface p-6 text-[13px]">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Student price</div>
          {student ? <p className="mt-1 text-text">Applied{profile?.edu_email ? ` via ${profile.edu_email}` : profile?.email ? ` via ${profile.email}` : ""}. Pro ${PRICES.proMonthlyStudent}/mo, Semester Pass ${PRICES.semesterStudent}.</p>
            : <p className="mt-1 text-text">Not applied. <Link href="/pricing" className="font-semibold text-ink underline">Add your school email</Link> to get Pro at ${PRICES.proMonthlyStudent}/mo and the pass at ${PRICES.semesterStudent}.</p>}
        </section>

        <section className="mt-4 rounded-2xl border border-line bg-surface p-6 text-[13px]">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Refunds</div>
          <p className="mt-1 text-text">Full refund within 7 days of your first payment, no questions. {plan !== "free" && (refund ? <span className="font-semibold text-ink">You are inside the window until {fmt(new Date(new Date(sub!.started_at!).getTime() + 7 * 86_400_000).toISOString())}.</span> : "Your window has passed; you can still cancel anytime from Manage billing.")} Email <a href="mailto:hello@rails.app?subject=Refund" className="font-semibold text-ink underline">hello@rails.app</a> from your account email.</p>
        </section>

        {events && events.length > 0 && (
          <section className="mt-4 rounded-2xl border border-line bg-surface p-6 text-[13px]">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted">History</div>
            <ul className="mt-2 flex flex-col gap-1">{events.map((e, i) => <li key={i} className="flex justify-between gap-3 text-text"><span>{String(e.kind).replace(/_/g, " ")}{e.plan ? ` · ${e.plan}` : ""}</span><span className="font-mono text-[11px] text-muted">{fmt(e.created_at)}</span></li>)}</ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
