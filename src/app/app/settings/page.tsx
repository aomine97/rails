import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { planOf } from "@/lib/billing/entitlements";
import { COUNTRY_CHIPS } from "@/lib/match/country";
import { saveAlertSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/settings");
  const [{ data: p }, plan, { data: sends }] = await Promise.all([
    supabase.from("profiles").select("full_name,email,alerts_enabled,alerts_min_fit,alerts_where,alerts_last_sent_at,onboarding_done").eq("id", user.id).single(),
    planOf(supabase, user.id),
    supabase.from("alert_sends").select("kind,sent_at,job_ids").eq("user_id", user.id).order("sent_at", { ascending: false }).limit(5),
  ]);
  if (!p?.onboarding_done) redirect("/onboarding");
  const WHERE: [string, string][] = [["near", "Near me"], ["us", "United States"], ["remote", "Remote only"], ...COUNTRY_CHIPS, ["anywhere", "Anywhere"]];
  return (
    <AppShell active="/app/settings" name={p.full_name}>
      <div className="mx-auto w-full max-w-2xl px-6 py-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Settings</h1>
        <form action={saveAlertSettings} className="mt-6 rounded-2xl border border-line bg-surface p-6 text-[14px]">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted">New-job alerts</div>
          <p className="mt-1 text-text">{plan === "free" ? "One email a day with the new jobs that clear your fit floor. Pro sends them the hour they post." : "You get an email within the hour when a new job clears your fit floor."} Sent to <span className="font-semibold text-ink">{p.email}</span>.</p>
          <label className="mt-4 flex items-center gap-2 font-semibold"><input type="checkbox" name="enabled" defaultChecked={p.alerts_enabled} /> Email me about new matches</label>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1"><span className="font-semibold">Only jobs with fit at least</span>
              <input name="minFit" type="number" min={50} max={100} defaultValue={p.alerts_min_fit ?? 80} className="rounded-lg border border-line bg-light px-3 py-2" />
              <span className="text-[12px] text-muted">80 is a good default: green and high amber.</span></label>
            <label className="flex flex-col gap-1"><span className="font-semibold">Where</span>
              <select name="where" defaultValue={p.alerts_where ?? "us"} className="rounded-lg border border-line bg-light px-3 py-2">{WHERE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          </div>
          <div className="mt-4 flex items-center gap-3"><button className="rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-white">Save</button>{p.alerts_last_sent_at && <span className="text-[12px] text-muted">Last email {new Date(p.alerts_last_sent_at).toLocaleString()}</span>}</div>
        </form>
        {sends && sends.length > 0 && (
          <div className="mt-4 rounded-2xl border border-line bg-surface p-6 text-[13px]">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Recent alerts</div>
            <ul className="mt-2 flex flex-col gap-1">{sends.map((s, i) => <li key={i} className="flex justify-between text-text"><span>{s.kind} · {s.job_ids.length} job{s.job_ids.length === 1 ? "" : "s"}</span><span className="font-mono text-[11px] text-muted">{new Date(s.sent_at).toLocaleString()}</span></li>)}</ul>
          </div>
        )}
        <div className="mt-4 rounded-2xl border border-line bg-surface p-6 text-[13px] text-text">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Profile and billing</div>
          <p className="mt-1"><Link href="/onboarding/confirm" className="font-semibold text-ink underline">Edit profile</Link> · <Link href="/app/billing" className="font-semibold text-ink underline">Billing</Link></p>
        </div>
      </div>
    </AppShell>
  );
}
