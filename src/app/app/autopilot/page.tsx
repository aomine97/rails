import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { CompanyLogo } from "@/components/company-logo";
import { UpgradeCard } from "@/components/upgrade-card";
import { planOf } from "@/lib/billing/entitlements";
import { nightlyCap } from "@/lib/autopilot/pick";
import { BAND_COLOR, bandOf } from "@/lib/match/score";
import { approveQueued, dismissQueued, saveAutopilotSettings } from "./actions";

export const dynamic = "force-dynamic";

type Row = { id: string; job_id: string; night: string; fit: number; status: string; coverage: number | null; prepared_at: string | null; jobs: { title: string; location: string | null; companies: { name: string; domain: string | null; logo_url: string | null } | null } | null };

export default async function AutopilotPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/autopilot");
  const [{ data: p }, plan, { data: rows }, { data: credits }] = await Promise.all([
    supabase.from("profiles").select("full_name,onboarding_done,autopilot_enabled,autopilot_min_fit,edu_verified").eq("id", user.id).single(),
    planOf(supabase, user.id),
    supabase.from("autopilot_queue").select("id,job_id,night,fit,status,coverage,prepared_at,jobs(title,location,companies(name,domain,logo_url))").eq("user_id", user.id).in("status", ["previewed", "prepared", "approved"]).order("night", { ascending: false }).order("fit", { ascending: false }).limit(60),
    supabase.from("credits").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!p?.onboarding_done) redirect("/onboarding");
  const cap = nightlyCap(plan);
  const queue = ((rows ?? []) as unknown as Row[]);
  const latestNight = queue[0]?.night ?? null;
  const tonight = queue.filter((r) => r.night === latestNight && r.status !== "approved");
  const earlier = queue.filter((r) => r.night !== latestNight && r.status !== "approved");
  const approved = queue.filter((r) => r.status === "approved");
  const prepared = tonight.filter((r) => r.status === "prepared").length;
  const nightLabel = latestNight ? new Date(latestNight + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) : null;

  const card = (r: Row, locked: boolean) => {
    const job = r.jobs; const co = job?.companies; const col = BAND_COLOR[bandOf(r.fit)];
    return (
      <li key={r.id} className={`grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-2xl border border-line bg-surface p-4 ${locked ? "opacity-90" : ""}`}>
        <CompanyLogo name={co?.name ?? ""} domain={co?.domain} logo={co?.logo_url} />
        <div className="min-w-0">
          <div className="truncate font-bold text-ink"><Link href={`/app/jobs/${r.job_id}`} className="hover:underline">{job?.title ?? "Job"}</Link></div>
          <div className="truncate text-[13px] text-text">{co?.name}{job?.location ? ` · ${job.location}` : ""}</div>
          <div className="mt-1 text-[12px] text-muted">
            {r.status === "prepared" ? <>Tailored resume ready{r.coverage != null ? <> · keyword fit <span className="font-bold text-ink">{r.coverage}%</span></> : null}</> : locked ? "Would be tailored and pre-filled with Pro" : "Queued for tailoring on the next run"}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="font-display text-2xl font-extrabold leading-none" style={{ color: col }}>{r.fit}</div>
          {locked ? <Link href="/pricing?reason=autopilot_preview" className="rounded-full bg-orange px-3 py-1.5 text-[12px] font-extrabold text-ink">Approve with Pro</Link> : (
            <div className="flex gap-1.5">
              <form action={approveQueued}><input type="hidden" name="id" value={r.id} /><button className="rounded-full bg-orange px-3 py-1.5 text-[12px] font-extrabold text-ink">Approve → open board</button></form>
              <form action={dismissQueued}><input type="hidden" name="id" value={r.id} /><button className="rounded-full px-2 py-1.5 text-[12px] font-semibold text-muted hover:text-ink">Skip</button></form>
            </div>
          )}
        </div>
      </li>
    );
  };

  return (
    <AppShell active="/app/autopilot" name={p.full_name} credits={plan === "free" ? credits?.balance ?? 3 : null}>
      <div className="mx-auto w-full max-w-4xl px-6 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">Autopilot</h1>
            <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-text">Every night Rails picks the new jobs above your fit floor, one per company, and {cap.prepare ? `tailors a resume for up to ${cap.count}` : "shows what it would prepare"}. You approve, the board opens with everything ready, and you click Submit. Rails never submits.</p>
          </div>
          <form action={saveAutopilotSettings} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-[13px]">
            <label className="flex items-center gap-1.5 font-semibold"><input type="checkbox" name="enabled" defaultChecked={p.autopilot_enabled} /> On</label>
            <label className="flex items-center gap-1.5">Fit ≥ <input name="minFit" type="number" min={60} max={100} defaultValue={p.autopilot_min_fit ?? 80} className="w-16 rounded-lg border border-line bg-light px-2 py-1" /></label>
            <span className="text-muted">{cap.count}/night</span>
            <button className="rounded-full bg-ink px-3 py-1 text-[12px] font-bold text-white">Save</button>
          </form>
        </div>

        {!cap.prepare && tonight.length > 0 && <div className="mt-6"><UpgradeCard reason="autopilot_preview" vars={{ count: tonight.length }} student={!!p.edu_verified} /></div>}

        <section className="mt-6">
          <div className="flex items-center justify-between"><h2 className="text-[11px] font-bold uppercase tracking-wide text-muted">{nightLabel ? `Overnight · ${nightLabel}` : "Overnight"}</h2><span className="font-mono text-[11px] text-muted">{cap.prepare ? `${prepared} of ${tonight.length} prepared` : `${tonight.length} picked`}</span></div>
          {tonight.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-[13px] text-muted">
              {queue.length === 0 ? <>Nothing yet. The first run is tonight at 6:30 AM ET. Lower your fit floor if you want more picks, or <Link href="/app" className="font-semibold text-ink underline">browse the feed</Link> meanwhile.</> : "Everything from the last run is handled."}
            </div>
          ) : <ul className="mt-3 flex flex-col gap-3">{tonight.map((r) => card(r, !cap.prepare))}</ul>}
        </section>

        {earlier.length > 0 && <section className="mt-8"><h2 className="text-[11px] font-bold uppercase tracking-wide text-muted">Earlier, still open</h2><ul className="mt-3 flex flex-col gap-3">{earlier.slice(0, 20).map((r) => card(r, !cap.prepare))}</ul></section>}
        {approved.length > 0 && <section className="mt-8"><h2 className="text-[11px] font-bold uppercase tracking-wide text-muted">Approved · in your tracker as Prepared</h2><ul className="mt-3 flex flex-col gap-2">{approved.slice(0, 20).map((r) => <li key={r.id} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-2 text-[13px]"><span className="truncate"><span className="font-bold text-ink">{r.jobs?.companies?.name}</span> · {r.jobs?.title}</span><Link href={`/app/jobs/${r.job_id}/apply`} className="shrink-0 rounded-full border border-line px-3 py-1 text-[12px] font-semibold text-ink">Open board</Link></li>)}</ul></section>}
      </div>
    </AppShell>
  );
}
