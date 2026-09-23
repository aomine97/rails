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

  const stats: [number | null, string, string?][] = [[f.applied, "Applied"], [f.oa, "OA+"], [f.interviews, "Interviews"], [f.offers, "Offers"], [f.interviewRate, "Interview rate", "%"]];
  return (
    <AppShell active="/app/tracker" name={profile.full_name} credits={credits?.balance ?? 3} wide>
      <div className="pb-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-ink">Tracker</h1>
            <p className="mt-1 text-[14px] text-muted">Every application in one place. Rails nudges you when one goes quiet.</p>
          </div>
          <div className="grid w-full grid-cols-5 divide-x divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-sm)] md:w-auto">
            {stats.map(([n, label, suffix]) => (
              <div key={label} className="px-1.5 py-3 text-center sm:px-5">
                <div className="font-display text-[18px] font-extrabold leading-none tracking-tight text-ink sm:text-[22px]">{n == null ? "—" : `${n}${suffix ?? ""}`}</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted sm:text-[11px]">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[15px] font-extrabold tracking-tight text-ink">Up next</h2>
              <span className="font-mono text-[12px] text-muted">{next.length} item{next.length === 1 ? "" : "s"}</span>
            </div>
            {next.length === 0 ? (
              <p className="mt-3 text-[13.5px] text-muted">Nothing due. Reminders you set and applications quiet for 7+ days show up here.</p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-line">
                {next.slice(0, 8).map(({ app, f: fu }) => (
                  <li key={app.id} className="flex flex-wrap items-center gap-2 py-2.5 text-[13.5px]">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${fu.kind === "overdue" ? "bg-red-chip text-red-chip-text" : fu.kind === "due" ? "bg-amber-chip text-amber-chip-text" : "bg-g2 text-g8"}`}>
                      {fu.kind === "overdue" ? `${fu.days}d overdue` : fu.kind === "due" ? "Due today" : "Suggested"}
                    </span>
                    <span className="font-bold text-ink">{app.company_name}</span>
                    <span className="text-muted">{app.title}</span>
                    <span className="text-text">{fu.text}</span>
                    <form action={completeFollowUp} className="ml-auto"><input type="hidden" name="id" value={app.id} /><button className="h-8 rounded-lg bg-ink px-3 text-[12px] font-bold text-white">Done</button></form>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form action={addApplication} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
            <h2 className="font-display text-[15px] font-extrabold tracking-tight text-ink">Add one you applied to elsewhere</h2>
            <div className="mt-3 flex flex-col gap-2">
              <input name="company" required placeholder="Company" aria-label="Company" className="h-10 rounded-[10px] border border-line bg-surface px-3 text-[14px] outline-none focus:border-blue" />
              <input name="title" required placeholder="Job title" aria-label="Job title" className="h-10 rounded-[10px] border border-line bg-surface px-3 text-[14px] outline-none focus:border-blue" />
              <input name="url" type="url" placeholder="Posting URL (optional)" aria-label="Posting URL" className="h-10 rounded-[10px] border border-line bg-surface px-3 text-[14px] outline-none focus:border-blue" />
              <div className="flex gap-2">
                <select name="stage" defaultValue="applied" aria-label="Stage" className="h-10 flex-1 rounded-[10px] border border-line bg-surface px-3 text-[14px] outline-none focus:border-blue">
                  {(["saved", "applied", "oa", "interview", "offer", "rejected"] as const).map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                </select>
                <button className="h-10 rounded-xl bg-ink px-4 text-[14px] font-bold text-white">Add</button>
              </div>
              <div className="text-[12px] text-muted">Have the link? <Link href="/app/paste" className="font-semibold text-ink underline">Paste it</Link> and Rails scores it too.</div>
            </div>
          </form>
        </section>

        <section className="-mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:snap-none md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-6" aria-label="Board">
          {COLUMNS.map((c) => (
            <div key={c.key} className="flex min-h-[240px] w-[82%] shrink-0 snap-start flex-col gap-2 rounded-2xl bg-g2 p-2 md:w-auto">
              <div className="flex items-center justify-between px-2 pt-1.5 pb-1">
                <span className="text-[12px] font-bold text-ink">{c.label}</span>
                <span className="rounded-md bg-surface px-1.5 font-mono text-[11px] font-bold text-muted">{cols[c.key].length}</span>
              </div>
              {cols[c.key].length === 0 && <div className="px-2 text-[12px] text-muted">{c.key === "saved" ? "Like a job to save it here." : "Nothing here yet."}</div>}
              {cols[c.key].map((a) => <TrackerCard key={a.id} app={a} now={now} />)}
            </div>
          ))}
        </section>
        {apps.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center text-[14px] text-muted">
            Nothing tracked yet. Click <span className="font-semibold text-ink">Apply with Autofill</span> on a job and answer &ldquo;Yes, applied&rdquo;, or add one above.
          </div>
        )}
      </div>
    </AppShell>
  );
}
