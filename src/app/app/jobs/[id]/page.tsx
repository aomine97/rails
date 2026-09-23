import Link from "next/link";
import type React from "react";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { MatchSide, levelLabel } from "@/components/match-panel";
import { Chip } from "@/components/ui";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { JobTags } from "@/lib/jobs/tags";
import { scoreJob, BAND_COLOR } from "@/lib/match/score";
import { explainScore } from "@/lib/match/explain";
import { ageLabel, buildFeed, payLabel, type FeedJobRow } from "@/lib/match/feed";
import { addSkillToProfile, hideJob, likeJob } from "../../actions";
import { SplitApplyButton } from "./apply/split";
import { CompanyLogo } from "@/components/company-logo";

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/jobs/${id}`);
  const [{ data: profile }, { data: job }, { data: mark }, { data: app }, { data: credits }] = await Promise.all([
    supabase.from("profiles").select("full_name,canonical,onboarding_done").eq("id", user.id).single(),
    supabase.from("jobs").select("id,title,location,remote,url,apply_url,posted_at,first_seen_at,tags,pay_min,pay_max,pay_period,description_text,employment_type,companies(id,name,ats,careers_url,domain,logo_url,size,industry,hq)").eq("id", id).maybeSingle(),
    supabase.from("matches").select("liked,hidden").eq("user_id", user.id).eq("job_id", id).maybeSingle(),
    supabase.from("applications").select("stage").eq("user_id", user.id).eq("job_id", id).maybeSingle(),
    supabase.from("credits").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!profile?.onboarding_done) redirect("/onboarding");
  const me = CanonicalProfile.safeParse(profile.canonical); if (!me.success) redirect("/onboarding");
  if (!job) notFound();
  const tags = JobTags.safeParse(job.tags);
  const company = (job.companies as unknown as { id: string; name: string; ats: string; careers_url: string | null; domain: string | null; logo_url: string | null; size: string | null; industry: string | null; hq: string | null } | null);
  const score = tags.success ? scoreJob(me.data, tags.data, { title: job.title, location: job.location }) : null;
  const why = tags.success && score ? explainScore(me.data, tags.data, score) : null;
  const pay = tags.success ? payLabel(tags.data, job as unknown as FeedJobRow) : null;
  const nowMs = new Date().getTime();
  const posted = job.posted_at ? Math.max(0, Math.floor((nowMs - new Date(job.posted_at).getTime()) / 86_400_000)) : null;

  // similar: same field, same level, best fit, not this one
  let similar: ReturnType<typeof buildFeed>["items"] = [];
  if (tags.success) {
    const { data: rows } = await supabase.from("jobs").select("id,title,location,remote,url,apply_url,posted_at,first_seen_at,tags,pay_min,pay_max,pay_period,companies(name,ats)")
      .is("closed_at", null).not("tagged_at", "is", null).contains("tags", { field: tags.data.field, level: tags.data.level }).order("first_seen_at", { ascending: false }).limit(400);
    similar = buildFeed(me.data, (rows ?? []) as unknown as FeedJobRow[], { where: "us" }).items.filter((i) => i.job.id !== id).slice(0, 5);
  }

  const paragraphs: string[] = String(job.description_text ?? "").split(/\n{2,}/).map((s: string) => s.trim()).filter(Boolean);
  const evidenceFor = (keys: string[]) => {
    const p = me.data; const set = new Set(keys);
    const sk = p.skills.find((s) => set.has(s.key)); if (sk) return sk.evidence ?? `${sk.name} on your profile`;
    const ex = p.experience.find((e) => e.skills.some((k) => set.has(k))); if (ex) return `${ex.title} at ${ex.org}`;
    return null;
  };

  const t = tags.success ? tags.data : null;
  const empType = t?.employmentType === "internship" ? "Internship" : t?.employmentType === "full_time" ? "Full-time" : t?.employmentType === "part_time" ? "Part-time" : t?.employmentType === "contract" ? "Contract" : job.employment_type ?? null;
  const workMode = t?.remote === "remote" ? "Remote" : t?.remote === "hybrid" ? "Hybrid" : t?.remote === "onsite" ? "Onsite" : null;
  const facts = t && score ? [
    ...(t.sponsorship === "yes" ? [{ ok: true, text: "Sponsorship offered" }] : t.sponsorship === "no" ? [{ ok: false, text: "No sponsorship" }] : []),
    ...(t.usCitizenRequired ? [{ ok: false, text: "US citizenship required" }] : []),
    ...(t.clearanceRequired !== "none" && t.clearanceRequired !== "unknown" ? [{ ok: false, text: `${t.clearanceRequired.replace("_", " ")} clearance` }] : []),
    ...(t.relocationOffered ? [{ ok: true, text: "Relocation offered" }] : []),
    ...(t.hasOnlineAssessment ? [{ ok: true, text: "Online assessment first" }] : []),
    ...score.hardBlocks.map((b) => ({ ok: false, text: b })),
  ].slice(0, 5) : [];
  const met = score?.requirements.filter((r) => r.status === "met").length ?? 0;

  return (
    <AppShell active="/app" name={profile.full_name} credits={credits?.balance ?? 3}>
      <Link href="/app" className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-ink">← Back to jobs</Link>
      <div className="mt-3 grid grid-cols-1 gap-6 pb-10 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <header className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)] sm:p-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <CompanyLogo name={company?.name ?? ""} domain={company?.domain} logo={company?.logo_url} size={64} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone="good">{ageLabel(posted)}</Chip>
                  {t && t.level !== "unknown" && <Chip tone="info">{levelLabel(t.level)}</Chip>}
                  {t?.hasOnlineAssessment && <Chip>OA first</Chip>}
                </div>
                <h1 className="mt-2 font-display text-[22px] font-extrabold leading-[1.15] tracking-tight text-ink sm:text-[26px]">{job.title}</h1>
                <div className="mt-1 text-[15px] text-text"><span className="font-semibold text-ink">{company?.name}</span>{company?.industry ? <span className="text-muted"> / {company.industry}</span> : null}{company?.size ? <span className="text-muted"> · {company.size} employees</span> : null}{company?.hq ? <span className="text-muted"> · HQ {company.hq}</span> : null}</div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line pt-4 sm:grid-cols-3">
              <Fact d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z">{job.location ?? (t?.remote === "remote" ? "Remote" : "Location TBD")}</Fact>
              {empType && <Fact d="M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z">{empType}</Fact>}
              {pay && <Fact d="M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"><span className="font-semibold text-ink">{pay}</span></Fact>}
              {workMode && <Fact d="M3 10.5 12 3l9 7.5 M5 9.5V21h14V9.5">{workMode}</Fact>}
              {t && t.yearsMin != null && <Fact d="M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4">{t.yearsMin}+ years experience</Fact>}
              {t && t.minDegree !== "unknown" && t.minDegree !== "none" && <Fact d="M22 10 12 5 2 10l10 5 10-5z M6 12v5c3 3 9 3 12 0v-5">{t.minDegree[0]!.toUpperCase() + t.minDegree.slice(1)}&apos;s or equivalent</Fact>}
            </div>
            {t?.summary && <p className="prose-measure mt-4 text-[14.5px] leading-relaxed text-text">{t.summary}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <SplitApplyButton jobId={job.id} url={job.apply_url} applied={!!app && app.stage !== "saved" && app.stage !== "prepared"} />
              {score && <form action={likeJob}><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="fit" value={score.fit} /><input type="hidden" name="band" value={score.band} /><input type="hidden" name="liked" value={mark?.liked ? "0" : "1"} />
                <button className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-[14px] font-bold ${mark?.liked ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink hover:border-ink"}`}>{mark?.liked ? "♥ Liked" : "♡ Like"}</button></form>}
              <a href={job.url} target="_blank" rel="noopener" className="inline-flex h-11 items-center rounded-xl border border-line bg-surface px-4 text-[14px] font-bold text-ink hover:border-ink">Original posting ↗</a>
              {score && <form action={hideJob} className="ml-auto"><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="fit" value={score.fit} /><input type="hidden" name="band" value={score.band} /><input type="hidden" name="hidden" value={mark?.hidden ? "0" : "1"} />
                <button className="text-[13px] font-semibold text-muted hover:text-ink">{mark?.hidden ? "Unhide" : "Hide this job"}</button></form>}
            </div>
          </header>

          {t && t.requirements.length > 0 && score && (
            <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between"><h2 className="font-display text-[17px] font-extrabold tracking-tight text-ink">What they ask for, checked against you</h2><span className="font-mono text-[13px] font-bold text-ink">{met}/{score.requirements.length}</span></div>
              <ul className="mt-4 flex flex-col divide-y divide-line">
                {score.requirements.map((r, i) => {
                  const keys = [...t.requiredSkills, ...t.preferredSkills].filter((k) => r.text.toLowerCase().includes(k.replace(/-/g, " ")) || r.text.toLowerCase().includes(k));
                  const ev = r.status === "met" ? (r.evidence ?? evidenceFor(keys)) : null;
                  const tone = r.status === "met" ? "bg-green-chip text-green-chip-text" : r.status === "missing" ? "bg-red-chip text-red-chip-text" : "bg-amber-chip text-amber-chip-text";
                  return (
                    <li key={i} className="grid grid-cols-[24px_1fr] gap-3 py-2.5 text-[14px] leading-relaxed">
                      <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold ${tone}`}>{r.status === "met" ? "✓" : r.status === "missing" ? "✗" : "!"}</span>
                      <div><span className="text-ink">{r.text}</span>{!r.required && <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-muted">preferred</span>}
                        {ev && <div className="text-[12.5px] text-green-chip-text">You bring: {ev}</div>}
                        {r.status === "missing" && keys.length > 0 && <form action={addSkillToProfile} className="mt-1"><input type="hidden" name="skill" value={keys[0]} /><button className="rounded-md border border-dashed border-line-strong px-2 py-0.5 text-[12px] font-semibold text-text hover:border-ink">+ I have {keys[0]}, add it</button></form>}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {score.requirements.some((r) => r.status === "partial") && <p className="mt-3 text-[12px] text-muted">! = something Rails can&apos;t check from a profile (soft skills, physical requirements). Cover it in the resume or letter.</p>}
            </section>
          )}

          <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
            <h2 className="font-display text-[17px] font-extrabold tracking-tight text-ink">The posting</h2>
            <div className="prose-measure mt-3 flex flex-col gap-3 text-[14.5px] leading-relaxed text-text">
              {paragraphs.length ? paragraphs.map((p: string, i: number) => <p key={i} className="whitespace-pre-line">{p}</p>) : <p className="text-muted">We haven&apos;t pulled the full text for this one yet. <a href={job.url} target="_blank" rel="noopener" className="font-semibold text-blue">Read it on the company site ↗</a></p>}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          {score && why ? (
            <>
              <MatchSide score={score} facts={facts} />
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Why this number</div>
                <p className="mt-1.5 text-[14px] font-semibold leading-snug text-ink">{why.overall}</p>
                <dl className="mt-3 flex flex-col gap-2.5 text-[13px] leading-relaxed text-text">
                  <div><dt className="font-bold text-ink">Skills <span className="font-mono text-muted">{score.sub.skills}</span></dt><dd>{why.skills}</dd></div>
                  <div><dt className="font-bold text-ink">Experience <span className="font-mono text-muted">{score.sub.experience}</span></dt><dd>{why.experience}</dd></div>
                  <div><dt className="font-bold text-ink">Field <span className="font-mono text-muted">{score.sub.field}</span></dt><dd>{why.field}</dd></div>
                </dl>
                {(score.missingRequired.length > 0 || score.missingPreferred.length > 0) && (
                  <div className="mt-4 border-t border-line pt-3">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted">They also want</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {[...score.missingRequired, ...score.missingPreferred].slice(0, 8).map((k) => (
                        <form key={k} action={addSkillToProfile}><input type="hidden" name="skill" value={k} /><button className="rounded-md border border-dashed border-line-strong bg-surface px-2 py-1 text-[12px] font-semibold text-text hover:border-ink">+ {k}</button></form>
                      ))}
                    </div>
                    <div className="mt-1 text-[11.5px] text-muted">Add one you actually have; the score updates.</div>
                  </div>
                )}
              </div>
              <div className="rounded-2xl bg-ink p-5 text-white shadow-[var(--shadow-md)]">
                <div className="font-display text-[15px] font-extrabold">Tailor my resume for this</div>
                <div className="mt-1 text-[12.5px] leading-relaxed text-[#C9D3E4]">Rewrites your bullets toward what this posting asks for, from your profile only. Shows the fit before and after.</div>
                <Link href={`/app/jobs/${job.id}/tailor`} className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-orange text-[14px] font-extrabold text-ink shadow-[var(--shadow-cta)]">Tailor · 1 credit</Link>
                <Link href={`/app/jobs/${job.id}/letter`} className="mt-2 flex h-11 w-full items-center justify-center rounded-xl border border-[#33466B] text-[14px] font-bold text-white hover:bg-navy-2">Cover letter · 1 credit</Link>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-line bg-surface p-5 text-[14px] text-muted">Not scored yet. The tagger reaches every new posting within the hour.</div>
          )}
          {similar.length > 0 && (
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Similar, ranked for you</div>
              <ul className="mt-2 flex flex-col divide-y divide-line">
                {similar.map((s) => (
                  <li key={s.job.id} className="flex items-center justify-between gap-2 py-2.5 text-[13.5px]">
                    <Link href={`/app/jobs/${s.job.id}`} className="min-w-0 truncate font-semibold text-ink hover:text-blue">{s.job.title}<span className="block truncate text-[12px] font-normal text-muted">{s.job.companies?.name}{s.job.location ? ` · ${s.job.location}` : ""}</span></Link>
                    <span className="font-mono text-[13px] font-bold" style={{ color: BAND_COLOR[s.score.band] }}>{s.score.fit}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
          <div className="fixed inset-x-0 bottom-[57px] z-30 md:bottom-0 flex items-center gap-2 border-t border-line bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-bold text-ink">{job.title}</div><div className="truncate text-[12px] text-muted">{company?.name}{score ? ` · fit ${score.fit}` : ""}</div></div>
        <Link href={`/app/jobs/${job.id}/tailor`} className="inline-flex h-10 shrink-0 items-center rounded-xl border border-line px-3 text-[13px] font-bold text-ink">Tailor</Link>
        <SplitApplyButton jobId={job.id} url={job.apply_url} applied={!!app && app.stage !== "saved" && app.stage !== "prepared"} />
      </div>
      <div className="h-16 lg:hidden" aria-hidden="true" />
    </AppShell>
  );
}

function Fact({ d, children }: { d: string; children: React.ReactNode }) {
  return <span className="flex items-center gap-2 text-[14px] text-text"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden="true"><path d={d} /></svg>{children}</span>;
}
