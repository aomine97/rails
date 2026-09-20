import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { COLUMNS, STAGE_LABEL, funnel, groupByColumn, upNext, type TrackedApp } from "@/lib/tracker/stages";
import { TrackerCard } from "./card";
import { addApplication, completeFollowUp } from "./actions";

export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/tracker");
  const [{ data: profile }, { data: rows }, { data: credits }] = await Promise.all([
    supabase.from("profiles").select("full_name,onboarding_done").eq("id", user.id).single(),
    supabase.from("applications").select("id,title,company_name,url,stage,applied_at,last_activity_at,next_action,next_action_at,notes,job_id,created_at").eq("user_id", user.id).order("last_activity_at", { ascending: false }),
    supabase.from("credits").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!profile?.onboarding_done) redirect("/onboarding");
  const apps = (rows ?? []) as TrackedApp[];
  const now = new Date().getTime();
  const f = funnel(apps);
  const cols = groupByColumn(apps);
  const next = upNext(apps, now);
  const stat = (n: number | null, label: string, suffix = "") => (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="font-display text-2xl font-extrabold leading-none tracking-tight text-ink">{n == null ? "—" : `${n}${suffix}`}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
    </div>
  );

  return (
    <AppShell active="/app/tracker" name={profile.full_name} credits={credits?.balance ?? 3}>
      <div className="mx-auto w-full max-w-7xl px-6 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">Tracker</h1>
            <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-text">Every application in one place. Move the stage, keep notes, set a reminder. Rails nudges you when something has gone quiet.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {stat(f.applied, "Applied")}{stat(f.oa, "OA+")}{stat(f.interviews, "Interviews")}{stat(f.offers, "Offers")}{stat(f.interviewRate, "Interview rate", "%")}
          </div>
        </div>

        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted">Up next</h2>
              <span className="font-mono text-[11px] text-muted">{next.length} item{next.length === 1 ? "" : "s"}</span>
            </div>
            {next.length === 0 ? (
              <p className="mt-3 text-[13px] text-muted">Nothing due. Reminders you set and applications that go quiet for 7+ days show up here.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {next.slice(0, 8).map(({ app, f: fu }) => (
                  <li key={app.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-light px-3 py-2 text-[13px]">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${fu.kind === "overdue" ? "bg-red-chip text-red-chip-text" : fu.kind === "due" ? "bg-amber-chip text-amber-chip-text" : "bg-surface text-text border border-line"}`}>
                      {fu.kind === "overdue" ? `${fu.days}d overdue` : fu.kind === "due" ? "Due today" : "Suggested"}
                    </span>
                    <span className="font-bold text-ink">{app.company_name}</span>
                    <span className="text-muted">{app.title}</span>
                    <span className="text-text">{fu.text}</span>
                    <form action={completeFollowUp} className="ml-auto"><input type="hidden" name="id" value={app.id} /><button className="rounded-full bg-ink px-3 py-1 text-[12px] font-bold text-white">Done</button></form>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form action={addApplication} className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted">Add one you applied to elsewhere</h2>
            <div className="mt-3 flex flex-col gap-2">
              <input name="company" required placeholder="Company" className="rounded-lg border border-line bg-light px-3 py-2 text-[13px]" />
              <input name="title" required placeholder="Job title" className="rounded-lg border border-line bg-light px-3 py-2 text-[13px]" />
              <input name="url" type="url" placeholder="Posting URL (optional)" className="rounded-lg border border-line bg-light px-3 py-2 text-[13px]" />
              <div className="flex gap-2">
                <select name="stage" defaultValue="applied" aria-label="Stage" className="flex-1 rounded-lg border border-line bg-light px-3 py-2 text-[13px]">
                  {(["saved", "applied", "oa", "interview", "offer", "rejected"] as const).map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                </select>
                <button className="rounded-full bg-orange px-4 py-2 text-[13px] font-extrabold text-ink">Add</button>
              </div>
              <div className="text-[11px] text-muted">Have the link? <Link href="/app/paste" className="font-semibold text-ink underline">Paste it</Link> and Rails scores it too.</div>
            </div>
          </form>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {COLUMNS.map((c) => (
            <div key={c.key} className="flex min-h-[200px] flex-col gap-2 rounded-2xl border border-line bg-ground/60 p-2">
              <div className="flex items-center justify-between px-1 pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{c.label}</span>
                <span className="font-mono text-[11px] font-bold text-ink">{cols[c.key].length}</span>
              </div>
              {cols[c.key].length === 0 && <div className="px-1 text-[12px] text-muted">{c.key === "saved" ? "Like a job on the Jobs page to save it here." : "—"}</div>}
              {cols[c.key].map((a) => <TrackerCard key={a.id} app={a} now={now} />)}
            </div>
          ))}
        </section>
        {apps.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-[13px] text-muted">
            Nothing tracked yet. Click <span className="font-semibold text-ink">Apply now</span> on a job and answer &ldquo;Yes, applied&rdquo;, or add one above.
          </div>
        )}
      </div>
    </AppShell>
  );
}
