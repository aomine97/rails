import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { scoreResume } from "@/lib/resume/score";
import { BAND_COLOR, bandOf } from "@/lib/match/score";

export default async function ResumePage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/resume");
  const [{ data: profile }, { data: tailored }, { data: credits }] = await Promise.all([
    supabase.from("profiles").select("full_name,canonical,onboarding_done,canonical_version").eq("id", user.id).single(),
    supabase.from("resumes").select("id,job_id,score,created_at,jobs(title,companies(name))").eq("user_id", user.id).eq("kind", "tailored").order("created_at", { ascending: false }).limit(10),
    supabase.from("credits").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!profile?.onboarding_done) redirect("/onboarding");
  const me = CanonicalProfile.safeParse(profile.canonical); if (!me.success) redirect("/onboarding");
  const s = scoreResume(me.data);
  const col = BAND_COLOR[bandOf(s.total)];
  const label = s.total >= 85 ? "EXCELLENT" : s.total >= 70 ? "SOLID" : s.total >= 50 ? "NEEDS WORK" : "START HERE";
  const potential = Math.min(100, s.total + s.fixes.reduce((a, f) => a + f.points, 0));
  return (
    <AppShell active="/app/resume" name={profile.full_name} credits={credits?.balance ?? 3}>
      <div className="pb-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-ink">Resume score</h1><p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-text">How your base resume reads as a document, before any job. Instant, explainable, and the fixes are ranked by how many points each is worth.</p></div>
          <Link href="/onboarding/confirm?next=/app/resume" className="inline-flex h-10 items-center rounded-xl border border-line bg-surface px-4 text-[13px] font-bold text-ink hover:border-ink">Edit my profile</Link>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-line bg-surface p-6 text-center">
              <div className="font-display text-7xl font-extrabold leading-none tracking-tight" style={{ color: col }}>{s.total}</div>
              <div className="mt-1 font-mono text-[11px] font-bold tracking-widest" style={{ color: col }}>{label}</div>
              <div className="mt-3 text-[12px] text-muted">Do everything below and it reads <span className="font-bold text-ink">{potential}</span>.</div>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Breakdown</div>
              <ul className="mt-3 flex flex-col gap-2.5">
                {s.bars.map((b) => { const c = BAND_COLOR[bandOf(b.score)]; return (
                  <li key={b.key} className="text-[12px]">
                    <div className="flex items-center justify-between"><span className="font-semibold text-ink">{b.label}</span><span className="font-mono font-bold" style={{ color: c }}>{b.score}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-light"><div className="h-1.5 rounded-full" style={{ width: `${b.score}%`, background: c }} /></div>
                    <div className="mt-0.5 text-[11px] text-muted">{b.why}</div>
                  </li>); })}
              </ul>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Ranked fixes</div>
              {s.fixes.length === 0 ? <p className="mt-2 text-sm text-text">Nothing obvious left. Tailor it per job from any job page.</p> : (
                <ol className="mt-3 flex flex-col gap-3">
                  {s.fixes.map((f, i) => (
                    <li key={i} className="grid grid-cols-[52px_1fr] gap-3 rounded-xl border border-line bg-light p-3">
                      <div className="text-center"><div className="font-display text-xl font-extrabold text-green">+{f.points}</div><div className="text-[10px] font-bold uppercase text-muted">pts</div></div>
                      <div><div className="text-[14px] font-bold text-ink">{f.title}</div><div className="mt-0.5 text-[12px] leading-relaxed text-text">{f.detail}</div>{f.where && <div className="mt-1 rounded bg-surface px-2 py-1 text-[11px] text-muted">e.g. &ldquo;{f.where}&rdquo;</div>}</div>
                    </li>
                  ))}
                </ol>
              )}
              <Link href="/onboarding/confirm?next=/app/resume" className="mt-4 inline-flex h-11 items-center rounded-xl bg-orange px-5 text-[14px] font-extrabold text-ink shadow-[var(--shadow-cta)]">Fix these on my profile → re-score</Link>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Tailored versions</div>
              {(tailored ?? []).length === 0 ? <p className="mt-2 text-sm text-muted">None yet. Open a job and hit Tailor.</p> : (
                <ul className="mt-2 divide-y divide-line">
                  {(tailored ?? []).map((r) => { const j = r.jobs as unknown as { title: string; companies: { name: string } | null } | null; return (
                    <li key={r.id} className="flex items-center justify-between py-2 text-[13px]">
                      <Link href={`/app/jobs/${r.job_id}/tailor`} className="font-semibold text-ink hover:text-blue">{j?.title ?? "Job"}<span className="block text-[11px] font-normal text-muted">{j?.companies?.name} · {new Date(r.created_at).toLocaleDateString()}</span></Link>
                      <span className="font-mono text-[12px] font-bold" style={{ color: BAND_COLOR[bandOf(r.score ?? 0)] }}>{r.score}% keywords</span>
                    </li>); })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
