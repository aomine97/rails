import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { MatchPanel } from "@/components/match-panel";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { JobTags } from "@/lib/jobs/tags";
import { scoreJob, BAND_COLOR } from "@/lib/match/score";
import { explainScore } from "@/lib/match/explain";
import { ageLabel, buildFeed, payLabel, type FeedJobRow } from "@/lib/match/feed";
import { addSkillToProfile, hideJob, likeJob } from "../../actions";
import { ApplyButton } from "../../apply-button";

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/jobs/${id}`);
  const [{ data: profile }, { data: job }, { data: mark }, { data: app }, { data: credits }] = await Promise.all([
    supabase.from("profiles").select("full_name,canonical,onboarding_done").eq("id", user.id).single(),
    supabase.from("jobs").select("id,title,location,remote,url,apply_url,posted_at,first_seen_at,tags,pay_min,pay_max,pay_period,description_text,employment_type,companies(id,name,ats,careers_url)").eq("id", id).maybeSingle(),
    supabase.from("matches").select("liked,hidden").eq("user_id", user.id).eq("job_id", id).maybeSingle(),
    supabase.from("applications").select("stage").eq("user_id", user.id).eq("job_id", id).maybeSingle(),
    supabase.from("credits").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!profile?.onboarding_done) redirect("/onboarding");
  const me = CanonicalProfile.safeParse(profile.canonical); if (!me.success) redirect("/onboarding");
  if (!job) notFound();
  const tags = JobTags.safeParse(job.tags);
  const company = (job.companies as unknown as { id: string; name: string; ats: string; careers_url: string | null } | null);
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

  return (
    <AppShell active="/app" name={profile.full_name} credits={credits?.balance ?? 3}>
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Link href="/app" className="text-sm font-semibold text-muted hover:text-ink">← Back to jobs</Link>
          <header className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
              {tags.success && <span className="rounded bg-blue-chip px-1.5 py-0.5 text-blue-chip-text">{tags.data.level.replace("_", " ")}</span>}
              {tags.success && tags.data.remote !== "unknown" && <span className="rounded bg-light px-1.5 py-0.5 text-text">{tags.data.remote}</span>}
              {tags.success && tags.data.clearanceRequired !== "none" && tags.data.clearanceRequired !== "unknown" && <span className="rounded bg-amber-chip px-1.5 py-0.5 text-amber-chip-text">{tags.data.clearanceRequired.replace("_", " ")} clearance</span>}
              {tags.success && tags.data.usCitizenRequired && <span className="rounded bg-amber-chip px-1.5 py-0.5 text-amber-chip-text">US citizen</span>}
              {tags.success && tags.data.sponsorship === "no" && <span className="rounded bg-amber-chip px-1.5 py-0.5 text-amber-chip-text">no sponsorship</span>}
              {tags.success && tags.data.hasOnlineAssessment && <span className="rounded bg-light px-1.5 py-0.5 text-text">online assessment first</span>}
              {tags.success && tags.data.relocationOffered && <span className="rounded bg-green-chip px-1.5 py-0.5 text-green-chip-text">relocation offered</span>}
              <span className="text-muted">{ageLabel(posted)}</span>
            </div>
            <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight">{job.title}</h1>
            <div className="text-[15px] text-text">{company?.name}{job.location ? ` · ${job.location}` : ""}{pay ? ` · ${pay}` : ""}{job.employment_type ? ` · ${job.employment_type}` : ""}</div>
            {tags.success && tags.data.summary && <p className="text-[14px] leading-relaxed text-text">{tags.data.summary}</p>}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <ApplyButton jobId={job.id} url={job.apply_url} title={job.title} company={company?.name ?? ""} applied={!!app && app.stage !== "saved"} />
              <a href={job.url} target="_blank" rel="noopener" className="rounded-full border border-line px-3 py-2 text-[13px] font-semibold text-text">Original posting ↗</a>
              {score && <>
                <form action={likeJob}><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="fit" value={score.fit} /><input type="hidden" name="band" value={score.band} /><input type="hidden" name="liked" value={mark?.liked ? "0" : "1"} />
                  <button className={`rounded-full border px-3 py-2 text-[13px] font-semibold ${mark?.liked ? "border-ink bg-ink text-white" : "border-line text-text"}`}>{mark?.liked ? "Liked" : "Like"}</button></form>
                <form action={hideJob}><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="fit" value={score.fit} /><input type="hidden" name="band" value={score.band} /><input type="hidden" name="hidden" value={mark?.hidden ? "0" : "1"} />
                  <button className="rounded-full px-3 py-2 text-[13px] font-semibold text-muted hover:text-ink">{mark?.hidden ? "Unhide" : "Hide"}</button></form>
              </>}
              <span className="ml-auto text-[11px] text-dim">{company?.ats}</span>
            </div>
          </header>

          {tags.success && tags.data.requirements.length > 0 && score && (
            <section className="rounded-2xl border border-line bg-surface p-6">
              <h2 className="font-display text-lg font-extrabold">What they ask for, checked against you</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {score.requirements.map((r, i) => {
                  const keys = [...tags.data.requiredSkills, ...tags.data.preferredSkills].filter((k) => r.text.toLowerCase().includes(k.replace(/-/g, " ")) || r.text.toLowerCase().includes(k));
                  const ev = r.status === "met" ? (r.evidence ?? evidenceFor(keys)) : null;
                  const c = r.status === "met" ? "text-green" : r.status === "missing" ? "text-red" : "text-amber";
                  return (
                    <li key={i} className="grid grid-cols-[22px_1fr] gap-2 text-[14px] leading-relaxed">
                      <span className={`font-mono font-bold ${c}`}>{r.status === "met" ? "✓" : r.status === "missing" ? "✗" : "!"}</span>
                      <div><span className="text-ink">{r.text}</span>{!r.required && <span className="ml-2 rounded bg-light px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted">preferred</span>}
                        {ev && <div className="text-[12px] text-muted">From your profile: {ev}</div>}
                        {r.status === "missing" && keys.length > 0 && <form action={addSkillToProfile} className="mt-1"><input type="hidden" name="skill" value={keys[0]} /><button className="rounded-md border border-dashed border-line-strong px-2 py-0.5 text-[12px] font-semibold text-text hover:border-ink">+ I have {keys[0]}, add it</button></form>}
                        {r.status === "partial" && <div className="text-[12px] text-muted">Not a skill we can check automatically; cover it in the resume or letter.</div>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="font-display text-lg font-extrabold">The posting</h2>
            <div className="mt-3 flex flex-col gap-3 text-[14px] leading-relaxed text-text">
              {paragraphs.length ? paragraphs.map((p: string, i: number) => <p key={i} className="whitespace-pre-line">{p}</p>) : <p className="text-muted">We haven&apos;t pulled the full text for this one yet. <a href={job.url} target="_blank" rel="noopener" className="font-semibold text-blue">Read it on the company site ↗</a></p>}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          {score && why ? (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <MatchPanel score={score} />
              <p className="mt-3 text-[13px] font-semibold" style={{ color: BAND_COLOR[score.band] }}>{why.overall}</p>
              <dl className="mt-3 flex flex-col gap-2 text-[12px] leading-relaxed text-text">
                <div><dt className="font-bold text-ink">Skills · {score.sub.skills}</dt><dd>{why.skills}</dd></div>
                <div><dt className="font-bold text-ink">Experience · {score.sub.experience}</dt><dd>{why.experience}</dd></div>
                <div><dt className="font-bold text-ink">Field · {score.sub.field}</dt><dd>{why.field}</dd></div>
              </dl>
              {(score.missingRequired.length > 0 || score.missingPreferred.length > 0) && (
                <div className="mt-3 border-t border-line pt-3">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted">They also want</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {[...score.missingRequired, ...score.missingPreferred].slice(0, 8).map((k) => (
                      <form key={k} action={addSkillToProfile}><input type="hidden" name="skill" value={k} /><button className="rounded-md border border-dashed border-line-strong bg-surface px-2 py-1 text-[12px] font-semibold text-text hover:border-ink">+ {k}</button></form>
                    ))}
                  </div>
                  <div className="mt-1 text-[11px] text-dim">Click one you actually have. The score updates.</div>
                </div>
              )}
              <div className="mt-4 rounded-xl bg-ink p-3 text-white">
                <div className="text-[13px] font-bold">Tailor my resume for this</div>
                <div className="mt-0.5 text-[12px] text-[#C9D3E4]">Rewrites your bullets toward what this posting asks for, from your profile only. Shows the fit before and after.</div>
                <Link href={`/app/jobs/${job.id}/tailor`} className="mt-2 block w-full rounded-lg bg-orange px-3 py-2 text-center text-[13px] font-extrabold text-ink">Tailor · 1 credit</Link>
                <Link href={`/app/jobs/${job.id}/letter`} className="mt-2 block w-full rounded-lg border border-[#33466B] px-3 py-2 text-center text-[13px] font-bold text-white">Cover letter · 1 credit</Link>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">Not scored yet. The tagger reaches every new posting within the hour.</div>
          )}
          {similar.length > 0 && (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Similar, ranked for you</div>
              <ul className="mt-2 flex flex-col divide-y divide-line">
                {similar.map((s) => (
                  <li key={s.job.id} className="flex items-center justify-between gap-2 py-2 text-[13px]">
                    <Link href={`/app/jobs/${s.job.id}`} className="min-w-0 truncate font-semibold text-ink hover:text-blue">{s.job.title}<span className="block truncate text-[11px] font-normal text-muted">{s.job.companies?.name}{s.job.location ? ` · ${s.job.location}` : ""}</span></Link>
                    <span className="font-mono text-[12px] font-bold" style={{ color: BAND_COLOR[s.score.band] }}>{s.score.fit}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
