import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { planOf } from "@/lib/billing/entitlements";
import { COUNTRY_CHIPS } from "@/lib/match/country";
import { assignInbound, createAlias, dismissInbound, saveAlertSettings, saveNudges } from "./actions";
import { STAGES, STAGE_LABEL } from "@/lib/tracker/stages";
import { CopyButton } from "@/components/copy-button";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/settings");
  const [{ data: p }, plan, { data: sends }, { data: inbound }, { data: apps }] = await Promise.all([
    supabase.from("profiles").select("full_name,email,alerts_enabled,alerts_min_fit,alerts_where,alerts_last_sent_at,onboarding_done,forwarding_alias,nudges_enabled").eq("id", user.id).single(),
    planOf(supabase, user.id),
    supabase.from("alert_sends").select("kind,sent_at,job_ids").eq("user_id", user.id).order("sent_at", { ascending: false }).limit(5),
    supabase.from("inbound_emails").select("id,from_addr,subject,snippet,kind,status,moved_to,created_at,applications(company_name,title)").eq("user_id", user.id).neq("status", "ignored").order("created_at", { ascending: false }).limit(12),
    supabase.from("applications").select("id,company_name,title").eq("user_id", user.id).order("last_activity_at", { ascending: false }).limit(100),
  ]);
  const domain = process.env.INBOUND_DOMAIN;
  const address = p?.forwarding_alias && domain ? `${p.forwarding_alias}@${domain}` : null;
  type In = { id: number; from_addr: string; subject: string; snippet: string; kind: string | null; status: string; moved_to: string | null; created_at: string; applications: { company_name: string; title: string } | null };
  const mails = (inbound ?? []) as unknown as In[];
  if (!p?.onboarding_done) redirect("/onboarding");
  const WHERE: [string, string][] = [["near", "Near me"], ["us", "United States"], ["remote", "Remote only"], ...COUNTRY_CHIPS, ["anywhere", "Anywhere"]];
  return (
    <AppShell active="/app/settings" name={p.full_name}>
      <div className="max-w-[720px] pb-10">
        <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-ink">Settings</h1>
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
        <section id="email" className="mt-4 rounded-2xl border border-line bg-surface p-6 text-[14px]">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Email updates to your tracker</div>
          <p className="mt-1 text-text">Forward recruiter emails to your Rails address and the tracker moves on its own: confirmations mark Applied, assessments mark OA, interview requests mark Interview, rejections close it. Rails keeps the sender, subject and one line, never the email.</p>
          {!domain ? (
            <p className="mt-3 rounded-lg bg-amber-chip px-3 py-2 text-[13px] text-amber-chip-text">Inbound email is not switched on for Rails yet.</p>
          ) : address ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2"><code className="rounded-lg bg-light px-3 py-2 font-mono text-[13px] text-ink">{address}</code><CopyButton text={address} /></div>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-[13px] text-text">
                <li>Gmail: Settings, See all settings, Forwarding and POP/IMAP, Add a forwarding address, paste the address above. The confirmation code shows up below within a minute.</li>
                <li>Create a filter. From: <code className="font-mono text-[12px]">greenhouse.io OR lever.co OR myworkday.com OR ashbyhq.com OR icims.com OR smartrecruiters.com OR workablemail.com</code>, or Subject: <code className="font-mono text-[12px]">application OR interview OR assessment</code>. Choose Forward it to your Rails address.</li>
                <li>Or forward any single email by hand. Same result.</li>
              </ol>
            </>
          ) : (
            <form action={createAlias} className="mt-3"><button className="rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-white">Create my Rails address</button></form>
          )}
          {mails.length > 0 && (
            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {mails.map((m) => (
                <li key={m.id} className="flex flex-col gap-2 px-4 py-3 text-[13px]">
                  <div className="flex items-baseline justify-between gap-3"><span className="truncate font-semibold text-ink">{m.subject || "(no subject)"}</span><span className="shrink-0 font-mono text-[11px] text-muted">{new Date(m.created_at).toLocaleDateString()}</span></div>
                  <div className="text-muted">{m.from_addr}{m.status === "moved" && m.applications ? ` · moved ${m.applications.company_name} to ${STAGE_LABEL[m.moved_to as keyof typeof STAGE_LABEL] ?? m.moved_to}` : m.status === "matched" && m.applications ? ` · logged on ${m.applications.company_name}` : ""}</div>
                  {m.status === "verification" && <p className="rounded-lg bg-blue-chip px-3 py-2 text-blue-chip-text">{m.snippet}</p>}
                  {m.status === "unmatched" && (
                    <form action={assignInbound} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <select name="app" required className="max-w-[260px] rounded-lg border border-line bg-light px-2 py-1.5" defaultValue=""><option value="" disabled>Which application?</option>{(apps ?? []).map((a) => <option key={a.id} value={a.id}>{a.company_name}, {a.title}</option>)}</select>
                      <select name="stage" className="rounded-lg border border-line bg-light px-2 py-1.5" defaultValue=""><option value="">Keep stage</option>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
                      <button className="rounded-full bg-ink px-3 py-1.5 text-[12px] font-bold text-white">Save</button>
                      <button formAction={dismissInbound} className="text-[12px] font-semibold text-muted hover:text-ink">Not about a job</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form action={saveNudges} className="mt-4 flex items-center gap-3 border-t border-line pt-4">
            <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name="nudges" defaultChecked={p.nudges_enabled ?? true} /> Email me when a follow-up is due</label>
            <button className="rounded-full border border-line px-3 py-1.5 text-[12px] font-bold text-ink hover:border-ink">Save</button>
          </form>
        </section>
        <div className="mt-4 rounded-2xl border border-line bg-surface p-6 text-[13px] text-text">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Profile and billing</div>
          <p className="mt-1"><Link href="/onboarding/confirm" className="font-semibold text-ink underline">Edit profile</Link> · <Link href="/app/billing" className="font-semibold text-ink underline">Billing</Link></p>
        </div>
      </div>
    </AppShell>
  );
}
