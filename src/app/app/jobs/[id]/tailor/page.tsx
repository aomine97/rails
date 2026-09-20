import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { JobTags } from "@/lib/jobs/tags";
import { planOf } from "@/lib/billing/entitlements";
import type { Tailored } from "@/lib/tailor/generate";
import { TailorForm } from "./form";

const GAP_LABEL = { add_if_you_have_it: "Add if you have it", cover_in_letter: "Cover in the letter", quick_project: "Weekend project", course_or_cert: "Course or cert", cannot_fix_now: "Can't fix now" } as const;

export default async function TailorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/jobs/${id}/tailor`);
  const [{ data: profile }, { data: job }, { data: prior }, { data: credits }] = await Promise.all([
    supabase.from("profiles").select("full_name,canonical,onboarding_done,edu_verified").eq("id", user.id).single(),
    supabase.from("jobs").select("id,title,tags,companies(name)").eq("id", id).maybeSingle(),
    supabase.from("resumes").select("id,diff,created_at,score").eq("user_id", user.id).eq("job_id", id).eq("kind", "tailored").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("credits").select("balance,refill_at").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!profile?.onboarding_done) redirect("/onboarding");
  if (!CanonicalProfile.safeParse(profile.canonical).success) redirect("/onboarding");
  if (!job) notFound();
  const tags = JobTags.safeParse(job.tags);
  const plan = await planOf(supabase, user.id);
  const t = prior?.diff as Tailored | null;
  const company = (job.companies as unknown as { name: string } | null)?.name ?? "";
  const col = (v: number) => v >= 85 ? "#16A34A" : v >= 70 ? "#D97706" : "#DC2626";

  return (
    <AppShell active="/app" name={profile.full_name} credits={plan === "free" ? credits?.balance ?? 3 : null}>
      <div className="mx-auto w-full max-w-5xl px-6 py-6">
        <Link href={`/app/jobs/${id}`} className="text-sm font-semibold text-muted hover:text-ink">← {job.title}</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">Tailor for {company}</h1>
            <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-text">Your bullets, reworded toward what this posting asks for. Every line shows where it came from. Nothing is added that isn&apos;t on your profile; the gap plan tells you what would move the number.</p>
          </div>
          {t && (
            <div className="flex items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3">
              <div className="text-center"><div className="text-[10px] font-bold uppercase tracking-wide text-muted">Keyword fit before</div><div className="font-display text-2xl font-extrabold" style={{ color: col(t.coverage.before) }}>{t.coverage.before}%</div></div>
              <div className="text-dim">→</div>
              <div className="text-center"><div className="text-[10px] font-bold uppercase tracking-wide text-muted">after tailoring</div><div className="font-display text-2xl font-extrabold" style={{ color: col(t.coverage.after) }}>{t.coverage.after}%</div></div>
              <div className="ml-2 text-[11px] leading-snug text-muted">of the {t.coverage.total} skills<br />this posting names</div>
            </div>
          )}
        </div>

        <div className="mt-5">
          <TailorForm jobId={id} hasPrior={!!t} tagged={tags.success} plan={plan} balance={credits?.balance ?? 3} refillAt={credits?.refill_at ?? null} student={!!profile.edu_verified} />
        </div>

        {t && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-5">
              <section className="rounded-2xl border border-line bg-surface p-5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Headline and summary</div>
                <div className="mt-2 font-display text-lg font-extrabold">{t.headline}</div>
                <p className="mt-1 text-[14px] leading-relaxed text-text">{t.summary}</p>
              </section>
              {t.experience.map((e) => (
                <section key={e.id} className="rounded-2xl border border-line bg-surface p-5">
                  <div className="font-display text-[15px] font-extrabold">{e.title} <span className="font-semibold text-muted">· {e.org}</span></div>
                  <ul className="mt-3 flex flex-col gap-3">
                    {e.after.map((b, i) => (
                      <li key={i} className="grid grid-cols-[18px_1fr] gap-2">
                        <span className={`mt-0.5 h-3.5 w-3.5 rounded-sm ${b.kind === "skill" ? "bg-green" : "bg-blue"}`} title={b.kind === "skill" ? "Surfaces a skill from your profile" : "Rewrite of a bullet you wrote"} />
                        <div>
                          <div className="text-[14px] leading-relaxed text-ink">{b.text}</div>
                          <div className="text-[11px] text-muted">{b.kind === "skill" ? `From your skills: ${b.from}` : `From: ${b.from}`}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {e.before.length > e.after.length && <div className="mt-2 text-[11px] text-dim">{e.before.length - e.after.length} weaker bullet{e.before.length - e.after.length === 1 ? "" : "s"} left out for this posting.</div>}
                </section>
              ))}
              <section className="rounded-2xl border border-line bg-surface p-5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Skills, in this posting&apos;s order</div>
                <div className="mt-2 flex flex-wrap gap-1.5">{t.skillsOrder.map((s) => <span key={s} className={`rounded-md px-2 py-1 text-[12px] font-semibold ${t.coverage.hitsAfter.some((k) => s.toLowerCase().includes(k.replace(/-/g, " ")) || k.includes(s.toLowerCase())) ? "bg-green-chip text-green-chip-text" : "bg-light text-text"}`}>{s}</span>)}</div>
              </section>
            </div>
            <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-2xl border border-line bg-surface p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Get it out</div>
                <Link href={`/app/jobs/${id}/tailor/print`} target="_blank" className="mt-2 block rounded-lg bg-orange px-3 py-2 text-center text-[13px] font-extrabold text-ink">Open as PDF</Link>
                <p className="mt-2 text-[11px] leading-relaxed text-muted">Opens a clean one-page version; use your browser&apos;s Save as PDF. Or copy the text below into your own template.</p>
                <details className="mt-2"><summary className="cursor-pointer text-[12px] font-semibold text-blue">Plain text</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-light p-3 text-[11px] leading-relaxed text-text">{t.text}</pre></details>
              </div>
              {t.gapPlan.length > 0 && (
                <div className="rounded-2xl border border-line bg-surface p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Gap plan</div>
                  <ul className="mt-2 flex flex-col gap-3">
                    {t.gapPlan.map((g, i) => (
                      <li key={i} className="text-[13px] leading-snug">
                        <div className="flex items-center gap-2"><span className="font-bold text-ink">{g.gap}</span><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${g.kind === "cannot_fix_now" ? "bg-red-chip text-red-chip-text" : g.kind === "add_if_you_have_it" ? "bg-green-chip text-green-chip-text" : "bg-amber-chip text-amber-chip-text"}`}>{GAP_LABEL[g.kind]}</span></div>
                        <div className="mt-0.5 text-[12px] text-text">{g.advice}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="text-[11px] text-dim">Generated {prior?.created_at ? new Date(prior.created_at).toLocaleString() : ""}. Re-tailor after you add skills to your profile.</div>
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}
