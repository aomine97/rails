import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { planOf } from "@/lib/billing/entitlements";
import { MODE_LABEL, type Mode } from "@/lib/interview/questions";
import { startDrill, startSession } from "./actions";

export const dynamic = "force-dynamic";

export default async function InterviewHome({ searchParams }: { searchParams: Promise<{ locked?: string; err?: string; job?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/interview");
  const [{ data: profile }, { data: credits }, plan, { data: apps }, { data: sessions }, { data: drills }] = await Promise.all([
    supabase.from("profiles").select("full_name,onboarding_done").eq("id", user.id).single(),
    supabase.from("credits").select("balance").eq("user_id", user.id).maybeSingle(),
    planOf(supabase, user.id),
    supabase.from("applications").select("job_id,title,company_name,stage").eq("user_id", user.id).not("job_id", "is", null).order("last_activity_at", { ascending: false }).limit(40),
    supabase.from("interview_sessions").select("id,title,company,mode,created_at,interview_answers(score)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(12),
    supabase.from("oa_drills").select("id,drill,review,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
  ]);
  if (!profile?.onboarding_done) redirect("/onboarding");
  const interviewing = (apps ?? []).filter((a) => a.stage === "interview" || a.stage === "oa");
  const cost = plan === "free" ? " · 1 credit" : "";
  const sel = "h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-[14px] text-ink";
  return (
    <AppShell active="/app/interview" name={profile.full_name} credits={credits?.balance ?? 3}>
      <div className="pb-10">
        <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-ink">Interview</h1>
        <p className="mt-1 text-[14px] text-muted">Practice with questions built from the posting and your own resume. Feedback quotes what you said.</p>
        {sp.locked && <p className="mt-4 rounded-xl bg-amber-chip px-4 py-2.5 text-[13px] text-amber-chip-text">Out of credits for now. They refill every 3 days, or <Link href="/pricing?reason=mock" className="font-bold underline">Pro makes practice unlimited</Link>.</p>}
        {sp.err && <p className="mt-4 rounded-xl bg-red-chip px-4 py-2.5 text-[13px] text-red-chip-text">That didn&apos;t generate. Try again; no credit was lost if nothing was created.</p>}
        {interviewing.length > 0 && <p className="mt-4 rounded-xl bg-blue-chip px-4 py-2.5 text-[13px] text-blue-chip-text"><b>{interviewing[0]!.company_name}</b> is at {interviewing[0]!.stage === "oa" ? "the online assessment" : "interview"} stage in your tracker. Practice for that one first.</p>}

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <form action={startSession} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
            <div><h2 className="font-display text-[18px] font-extrabold tracking-tight text-ink">Mock interview</h2><p className="text-[13px] text-muted">8 questions. Answer by typing or out loud. Score, what to keep, what to cut, and a tighter version in your own words.</p></div>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">Practising for
              <select name="job" defaultValue={sp.job ?? interviewing[0]?.job_id ?? ""} className={sel}>
                <option value="">My target role (no specific posting)</option>
                {(apps ?? []).map((a) => <option key={a.job_id} value={a.job_id!}>{a.company_name}, {a.title}</option>)}
              </select>
            </label>
            <fieldset className="flex flex-col gap-1.5"><legend className="text-[13px] font-semibold text-ink">Format</legend>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {(Object.keys(MODE_LABEL) as Mode[]).map((m, i) => (
                  <label key={m} className="flex cursor-pointer items-center justify-center rounded-xl border border-line px-2 py-2.5 text-[13px] font-semibold text-ink has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white">
                    <input type="radio" name="mode" value={m} defaultChecked={i === 0} className="sr-only" />{MODE_LABEL[m]}
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="h-11 rounded-xl bg-orange text-[14px] font-extrabold text-ink shadow-[var(--shadow-cta)]">Start{cost}</button>
          </form>

          <form action={startDrill} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
            <div><h2 className="font-display text-[18px] font-extrabold tracking-tight text-ink">OA drill</h2><p className="text-[13px] text-muted">One timed problem like the HackerRank and CodeSignal screens. Write a solution, then get it reviewed line by line. Topics rotate.</p></div>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">For
              <select name="job" defaultValue="" className={sel}>
                <option value="">General practice</option>
                {(apps ?? []).map((a) => <option key={a.job_id} value={a.job_id!}>{a.company_name}, {a.title}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">Language
              <select name="language" defaultValue="Python" className={sel}>{["Python", "Java", "JavaScript", "C++", "C#", "Go"].map((l) => <option key={l}>{l}</option>)}</select>
            </label>
            <button className="mt-auto h-11 rounded-xl bg-ink text-[14px] font-extrabold text-white hover:bg-navy-2">New drill{cost}</button>
          </form>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-display text-[15px] font-extrabold text-ink">Past sessions</h2>
            {(sessions ?? []).length === 0 ? <p className="mt-2 text-[13px] text-muted">None yet.</p> : (
              <ul className="mt-2 divide-y divide-line">
                {(sessions ?? []).map((s) => {
                  const scores = ((s.interview_answers ?? []) as { score: number | null }[]).map((a) => a.score ?? 0);
                  const avg = scores.length ? (scores.reduce((x, y) => x + y, 0) / scores.length).toFixed(1) : null;
                  return <li key={s.id}><Link href={`/app/interview/${s.id}`} className="flex items-center justify-between gap-3 py-2.5 text-[14px] hover:text-blue"><span className="min-w-0 truncate"><b className="text-ink">{s.company ?? "Target role"}</b> · {s.title} · {MODE_LABEL[s.mode as Mode]}</span><span className="shrink-0 font-mono text-[12px] text-muted">{avg ? `${avg}/10 · ${scores.length} answered` : "not started"}</span></Link></li>;
                })}
              </ul>
            )}
          </section>
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-display text-[15px] font-extrabold text-ink">Past drills</h2>
            {(drills ?? []).length === 0 ? <p className="mt-2 text-[13px] text-muted">None yet.</p> : (
              <ul className="mt-2 divide-y divide-line">
                {(drills ?? []).map((d) => {
                  const dr = d.drill as { title: string; topic?: string }; const rv = d.review as { verdict?: string } | null;
                  return <li key={d.id}><Link href={`/app/interview/oa/${d.id}`} className="flex items-center justify-between gap-3 py-2.5 text-[14px] hover:text-blue"><span className="min-w-0 truncate"><b className="text-ink">{dr.title}</b>{dr.topic ? ` · ${dr.topic}` : ""}</span><span className="shrink-0 font-mono text-[12px] text-muted">{rv?.verdict ?? "open"}</span></Link></li>;
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
