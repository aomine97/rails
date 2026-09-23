import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { MatchSide, levelLabel } from "@/components/match-panel";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { ageLabel, buildFeed, payLabel, type FeedJobRow } from "@/lib/match/feed";
import { addSkillToProfile, hideJob, likeJob } from "./actions";
import { ApplyButton } from "./apply-button";
import { CompanyLogo } from "@/components/company-logo";
import { COUNTRY_CHIPS } from "@/lib/match/country";
import { FeedFilters } from "./filters";
import { upNext, type TrackedApp } from "@/lib/tracker/stages";
import { momentum } from "@/lib/coach/context";

const PAGE = 25;
const FIELDS = [["software", "Software"], ["data", "Data"], ["cloud", "Cloud"], ["it_support", "IT support"], ["cyber", "Cyber"], ["product", "Product"], ["electrical", "Electrical"], ["mechanical", "Mechanical"], ["civil", "Civil"], ["chemical", "Chemical"], ["biotech", "Biotech"], ["science", "Science"], ["math", "Math & stats"], ["nursing", "Nursing"], ["healthcare", "Healthcare"]] as const;
const LEVELS = [["internship", "Internship"], ["new_grad", "New Grad"], ["entry", "Entry Level"], ["mid", "Mid-Level"], ["senior", "Senior"]] as const;
const WHERE = [["near", "Near me"], ["us", "US"], ["remote", "Remote"], ...COUNTRY_CHIPS, ["anywhere", "Anywhere"]] as [string, string][];

type SP = { tab?: string; field?: string; level?: string; where?: string; sort?: string; q?: string; page?: string; top?: string };

export default async function Feed({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app");
  const [{ data: profile }, { data: credits }] = await Promise.all([
    supabase.from("profiles").select("full_name,canonical,onboarding_done").eq("id", user.id).single(),
    supabase.from("credits").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!profile?.onboarding_done) redirect("/onboarding");
  const parsed = CanonicalProfile.safeParse(profile.canonical);
  if (!parsed.success) redirect("/onboarding");
  const me = parsed.data;

  const [{ data: rows }, { data: marks }, { data: apps }, { data: tailoredRows }] = await Promise.all([
    supabase.from("jobs").select("id,title,location,remote,url,apply_url,posted_at,first_seen_at,tags,pay_min,pay_max,pay_period,description_text,source,companies(name,ats,domain,logo_url,tier,industry,size)")
      .is("closed_at", null).not("tagged_at", "is", null).order("first_seen_at", { ascending: false }).limit(3000),
    supabase.from("matches").select("job_id,liked,hidden").eq("user_id", user.id),
    supabase.from("applications").select("id,job_id,title,company_name,url,stage,applied_at,last_activity_at,next_action,next_action_at,notes,created_at").eq("user_id", user.id).order("last_activity_at", { ascending: false }),
    supabase.from("resumes").select("job_id").eq("user_id", user.id).eq("kind", "tailored"),
  ]);
  const tailoredJobs = new Set((tailoredRows ?? []).map((r) => r.job_id));
  const mo = momentum(((apps ?? []) as TrackedApp[]).map((a) => ({ ...a, tailored: !!a.job_id && tailoredJobs.has(a.job_id) })), new Date().getTime());
  const due = upNext((apps ?? []) as TrackedApp[], new Date().getTime()).filter((x) => x.f.kind !== "suggested");
  const appliedIds = new Set((apps ?? []).filter((a) => a.stage !== "saved").map((a) => a.job_id));
  const liked = new Set((marks ?? []).filter((m) => m.liked).map((m) => m.job_id));
  const hidden = new Set((marks ?? []).filter((m) => m.hidden).map((m) => m.job_id));
  const tab = sp.tab ?? "recommended";
  const mine = new Set((marks ?? []).map((m) => m.job_id));
  const visibleRows = ((rows ?? []) as unknown as FeedJobRow[]).filter((r) => r.source !== "paste" || mine.has(r.id));
  const feed = buildFeed(me, visibleRows, { field: sp.field, level: sp.level, where: sp.where ?? "us", q: sp.q, sort: sp.sort === "new" ? "new" : "fit", top: sp.top === "1" });
  let items = tab === "hidden" ? feed.items.filter((i) => hidden.has(i.job.id)) : feed.items.filter((i) => !hidden.has(i.job.id));
  if (tab === "liked") items = items.filter((i) => liked.has(i.job.id));
  if (tab === "external") items = items.filter((i) => i.job.id && (i.job as unknown as { source?: string }).source === "paste");
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageItems = items.slice((page - 1) * PAGE, page * PAGE);
  const href = (patch: Partial<SP>) => { const p = new URLSearchParams({ ...sp, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v ?? ""])) } as Record<string, string>); [...p.keys()].forEach((k) => !p.get(k) && p.delete(k)); return `/app?${p}`; };

  return (
    <AppShell active="/app" name={profile.full_name} credits={credits?.balance ?? 3}>
      <div className="flex flex-col">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-ink">Jobs</h1>
            <p className="mt-1 text-[14px] text-muted"><span className="font-semibold text-ink">{items.length.toLocaleString()}</span> match your profile · <span className="font-semibold text-blue">{feed.newToday} new since yesterday</span> · every one verified live</p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <form action="/app" className="relative min-w-0 flex-1 sm:flex-none"><svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-g6" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg><input name="q" defaultValue={sp.q} placeholder="Search title, company, city" className="h-10 w-full sm:w-72 rounded-xl border border-line bg-surface pl-9 pr-3 text-[14px] outline-none focus:border-blue" /></form>
            <Link href="/app/paste" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[14px] font-bold text-ink hover:border-ink sm:px-4">+ <span className="hidden sm:inline">Paste a link</span><span className="sm:hidden">Link</span></Link>
          </div>
        </div>
        <div className="-mx-4 mt-4 flex items-center gap-1 overflow-x-auto whitespace-nowrap border-b border-line px-4 text-[14px] font-semibold [scrollbar-width:none] md:mx-0 md:px-0">
          {[["recommended", "Recommended"], ["liked", `Liked${liked.size ? ` ${liked.size}` : ""}`], ["applied", `Applied${appliedIds.size ? ` ${appliedIds.size}` : ""}`], ["external", "External"], ["hidden", `Hidden${hidden.size ? ` ${hidden.size}` : ""}`]].map(([k, l]) => (
            <Link key={k} href={href({ tab: k, page: "1" })} className={`-mb-px border-b-2 px-3 pb-2.5 pt-1 ${tab === k ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}>{l}</Link>
          ))}
        </div>
        {due.length > 0 && (
          <Link href="/app/tracker" className="mt-4 flex items-center gap-2 rounded-xl bg-amber-chip px-4 py-2.5 text-[13px] text-amber-chip-text">
            <span className="font-bold">{due.length} follow-up{due.length === 1 ? "" : "s"} due</span>
            <span className="truncate">{due.slice(0, 3).map((x) => `${x.app.company_name}: ${x.f.text}`).join(" · ")}</span>
            <span className="ml-auto font-semibold">Open tracker →</span>
          </Link>
        )}

        {mo && mo.withRate > mo.withoutRate && (
          <Link href="/app/coach" className="mt-3 flex items-center gap-2 rounded-xl bg-blue-chip px-4 py-2.5 text-[13px] text-blue-chip-text">
            <span className="font-bold">Your tailored applications: {mo.withRate}% interview rate. Untailored: {mo.withoutRate}%.</span>
            <span className="hidden truncate sm:inline">From your own tracker ({mo.withN} vs {mo.withoutN} applications).</span>
            <span className="ml-auto font-semibold">Ask Coach →</span>
          </Link>
        )}

        <FeedFilters levels={LEVELS} fields={FIELDS} where={WHERE} current={{ level: sp.level, field: sp.field, where: sp.where, top: sp.top === "1" }} base={{ tab: sp.tab, q: sp.q, sort: sp.sort }} />

        <div className="flex items-center justify-end gap-3 pb-3 pt-3 text-[13px] font-semibold">
          <span className="text-muted">Sort</span>
          <Link href={href({ sort: "fit", page: "1" })} className={sp.sort !== "new" ? "text-ink underline underline-offset-4" : "text-muted hover:text-ink"}>Best fit</Link>
          <Link href={href({ sort: "new", page: "1" })} className={sp.sort === "new" ? "text-ink underline underline-offset-4" : "text-muted hover:text-ink"}>Newest</Link>
        </div>

        {tab === "applied" ? (
          (apps ?? []).filter((a) => a.stage !== "saved").length === 0 ? <Empty title="Nothing applied yet." body="Hit Apply now on a card, apply on the company site, and answer Yes when the card asks. It lands here with its stage." /> : (
            <ul className="flex flex-col gap-2 pb-10">
              {(apps ?? []).filter((a) => a.stage !== "saved").map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
                  <div><a href={a.url ?? "#"} target="_blank" rel="noopener" className="font-semibold text-ink hover:text-blue">{a.title}</a><div className="text-sm text-muted">{a.company_name}</div></div>
                  <div className="flex items-center gap-3 text-xs"><span className="rounded bg-blue-chip px-2 py-1 font-bold uppercase text-blue-chip-text">{a.stage}</span><span className="text-muted">{a.applied_at ? new Date(a.applied_at).toLocaleDateString() : ""}</span></div>
                </li>
              ))}
            </ul>
          )
        ) : tab === "external" && pageItems.length === 0 ? (
          <Empty title="No external jobs yet." body="Paste any posting link (LinkedIn, Handshake, a company site) and Rails scores it like the rest." />
        ) : pageItems.length === 0 ? (
          <Empty title={items.length === 0 && feed.total === 0 ? "Nothing matches yet." : "No jobs on this page."} body={feed.total === 0 ? "Try clearing a filter. If the feed is empty with no filters, the tagger is still catching up on new postings; check back in 15 minutes." : "Go back a page or clear a filter."} />
        ) : (
          <ul className="flex flex-col gap-4 pb-10">
            {pageItems.map(({ job, tags, score, isNew, ageDays, otherLocations }) => {
              const pay = payLabel(tags, job);
              const company = job.companies?.name ?? "";
              const summary = tags.summary || (job.description_text ? job.description_text.replace(/\s+/g, " ").slice(0, 220).replace(/\s\S*$/, "") + "…" : "");
              const gaps = [...score.missingRequired, ...score.missingPreferred].slice(0, 4);
              const co = job.companies as (typeof job.companies & { tier?: number | null; industry?: string | null; size?: string | null }) | null;
              const empType = tags.employmentType === "internship" ? "Internship" : tags.employmentType === "full_time" ? "Full-time" : tags.employmentType === "part_time" ? "Part-time" : tags.employmentType === "contract" ? "Contract" : null;
              const workMode = tags.remote === "remote" ? "Remote" : tags.remote === "hybrid" ? "Hybrid" : tags.remote === "onsite" ? "Onsite" : null;
              const facts = [
                ...(tags.sponsorship === "yes" ? [{ ok: true, text: "Sponsorship offered" }] : tags.sponsorship === "no" ? [{ ok: false, text: "No sponsorship" }] : []),
                ...(tags.clearanceRequired !== "none" && tags.clearanceRequired !== "unknown" ? [{ ok: false, text: `${tags.clearanceRequired.replace("_", " ")} clearance` }] : []),
                ...(tags.relocationOffered ? [{ ok: true, text: "Relocation offered" }] : []),
                ...(tags.hasOnlineAssessment ? [{ ok: true, text: "Online assessment first" }] : []),
                ...(score.hardBlocks.map((b) => ({ ok: false, text: b }))),
              ].slice(0, 4);
              return (
                <li key={job.id} className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(11,27,58,0.04),0_8px_24px_rgba(11,27,58,0.04)] md:grid-cols-[1fr_250px]">
                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="flex items-start gap-4">
                      <CompanyLogo name={company} domain={co?.domain} logo={co?.logo_url} size={56} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                          <span className="rounded-md bg-green-chip px-2 py-0.5 text-green-chip-text">{ageLabel(ageDays)}</span>
                          {isNew && <span className="rounded-md bg-ink px-2 py-0.5 text-white">New</span>}
                          {co?.tier === 1 && <span className="rounded-md bg-amber-chip px-2 py-0.5 text-amber-chip-text">★ Top company</span>}
                          {score.matchedSkills.length >= 3 && <span className="rounded-md bg-blue-chip px-2 py-0.5 text-blue-chip-text">{score.matchedSkills.length} skills match</span>}
                        </div>
                        <Link href={`/app/jobs/${job.id}`} className="mt-1.5 block font-display text-[21px] font-extrabold leading-tight tracking-tight text-ink hover:text-blue">{job.title}</Link>
                        <div className="mt-0.5 text-[14px] text-text"><span className="font-semibold text-ink">{company}</span>{co?.industry ? <span className="text-muted"> / {co.industry}</span> : null}{co?.size ? <span className="text-muted"> · {co.size} employees</span> : null}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-line pt-3 text-[13.5px] text-text sm:grid-cols-3">
                      <span className="flex items-center gap-2"><Ico d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />{job.location ?? (tags.remote === "remote" ? "Remote" : "Location TBD")}{otherLocations.length ? <span className="text-muted"> +{otherLocations.length}</span> : null}</span>
                      {empType && <span className="flex items-center gap-2"><Ico d="M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />{empType}</span>}
                      {pay ? <span className="flex items-center gap-2 font-semibold text-ink"><Ico d="M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />{pay}</span> : null}
                      {workMode && <span className="flex items-center gap-2"><Ico d="M3 10.5 12 3l9 7.5 M5 9.5V21h14V9.5" />{workMode}</span>}
                      {tags.level !== "unknown" && <span className="flex items-center gap-2"><Ico d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 17l-6.5 4 2-7.5L2 9h7z" />{levelLabel(tags.level)}</span>}
                      {tags.yearsMin != null && <span className="flex items-center gap-2"><Ico d="M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4" />{tags.yearsMin}+ years exp</span>}
                    </div>
                    {summary && <p className="line-clamp-2 text-[13px] leading-relaxed text-text">{summary}</p>}
                    <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
                      {score.matchedSkills.slice(0, 5).map((k) => <span key={k} className="rounded-md bg-green-chip px-2 py-1 text-green-chip-text">✓ {k}</span>)}
                      {gaps.slice(0, 4).map((k) => (
                        <form key={k} action={addSkillToProfile}><input type="hidden" name="skill" value={k} />
                          <button title={`Add ${k} to your profile if you actually have it`} className="rounded-md border border-dashed border-line-strong bg-surface px-2 py-1 text-text hover:border-ink hover:text-ink">+ {k}</button></form>
                      ))}
                      {score.softNotes.map((b) => <span key={b} className="rounded-md bg-amber-chip px-2 py-1 text-amber-chip-text">! {b}</span>)}
                    </div>
                    <div className="mt-auto flex items-center gap-2 border-t border-line pt-3">
                      <span className="text-[12px] text-muted">via {ATS_LABEL[job.companies?.ats ?? ""] ?? job.companies?.ats}</span>
                      <div className="ml-auto flex items-center gap-2">
                        <form action={hideJob}><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="fit" value={score.fit} /><input type="hidden" name="band" value={score.band} /><input type="hidden" name="hidden" value={tab === "hidden" ? "0" : "1"} />
                          <button title={tab === "hidden" ? "Unhide" : "Hide"} aria-label={tab === "hidden" ? "Unhide" : "Hide"} className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-muted hover:border-ink hover:text-ink">{tab === "hidden" ? "↺" : "⊘"}</button></form>
                        <form action={likeJob}><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="fit" value={score.fit} /><input type="hidden" name="band" value={score.band} /><input type="hidden" name="liked" value={liked.has(job.id) ? "0" : "1"} />
                          <button title={liked.has(job.id) ? "Unlike" : "Like"} aria-label="Like" className={`flex h-10 w-10 items-center justify-center rounded-full border text-[16px] ${liked.has(job.id) ? "border-ink bg-ink text-white" : "border-line text-muted hover:border-ink hover:text-ink"}`}>{liked.has(job.id) ? "♥" : "♡"}</button></form>
                        <Link href={`/app/jobs/${job.id}`} className="rounded-full border border-line px-4 py-2.5 text-[13px] font-bold text-ink hover:border-ink">Details</Link>
                        <ApplyButton jobId={job.id} url={job.apply_url} title={job.title} company={company} applied={appliedIds.has(job.id)} />
                      </div>
                    </div>
                  </div>
                  <MatchSide score={score} facts={facts} />
                </li>
              );
            })}
            {items.length > PAGE && (
              <li className="flex items-center justify-between px-1 py-2 text-sm">
                {page > 1 ? <Link href={href({ page: String(page - 1) })} className="font-semibold text-blue">← Previous</Link> : <span />}
                <span className="text-muted">Page {page} of {Math.ceil(items.length / PAGE)}</span>
                {page * PAGE < items.length ? <Link href={href({ page: String(page + 1) })} className="font-semibold text-blue">Next →</Link> : <span />}
              </li>
            )}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

const ATS_LABEL: Record<string, string> = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", smartrecruiters: "SmartRecruiters", workday: "Workday", usajobs: "USAJobs", icims: "iCIMS", oracle: "Oracle", workable: "Workable", jobvite: "Jobvite", taleo: "Taleo", paste: "your paste" };
function Ico({ d }: { d: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden="true"><path d={d} /></svg>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="my-6 rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center">
      <div className="font-display text-lg font-extrabold">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text">{body}</p>
    </div>
  );
}
