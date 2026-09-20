import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { MatchPanel } from "@/components/match-panel";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { ageLabel, buildFeed, payLabel, type FeedJobRow } from "@/lib/match/feed";
import { hideJob, likeJob } from "./actions";

const PAGE = 25;
const FIELDS = [["software", "Software"], ["data", "Data"], ["cloud", "Cloud"], ["it_support", "IT support"], ["cyber", "Cyber"], ["product", "Product"]] as const;
const LEVELS = [["internship", "Internship"], ["new_grad", "New grad"], ["entry", "Entry level"]] as const;

type SP = { tab?: string; field?: string; level?: string; remote?: string; q?: string; page?: string };

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

  const [{ data: rows }, { data: marks }] = await Promise.all([
    supabase.from("jobs").select("id,title,location,remote,url,apply_url,posted_at,first_seen_at,tags,pay_min,pay_max,pay_period,companies(name,ats)")
      .is("closed_at", null).not("tagged_at", "is", null).order("first_seen_at", { ascending: false }).limit(2500),
    supabase.from("matches").select("job_id,liked,hidden").eq("user_id", user.id),
  ]);
  const liked = new Set((marks ?? []).filter((m) => m.liked).map((m) => m.job_id));
  const hidden = new Set((marks ?? []).filter((m) => m.hidden).map((m) => m.job_id));
  const tab = sp.tab ?? "recommended";
  const feed = buildFeed(me, (rows ?? []) as unknown as FeedJobRow[], { field: sp.field, level: sp.level, remote: sp.remote as "remote" | "local" | undefined, q: sp.q });
  let items = feed.items.filter((i) => !hidden.has(i.job.id));
  if (tab === "liked") items = items.filter((i) => liked.has(i.job.id));
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageItems = items.slice((page - 1) * PAGE, page * PAGE);
  const href = (patch: Partial<SP>) => { const p = new URLSearchParams({ ...sp, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v ?? ""])) } as Record<string, string>); [...p.keys()].forEach((k) => !p.get(k) && p.delete(k)); return `/app?${p}`; };

  return (
    <AppShell active="/app" name={profile.full_name} credits={credits?.balance ?? 3}>
      <div className="flex flex-col">
        <div className="flex items-center gap-1 border-b border-line bg-surface px-6 pt-3 text-sm font-semibold">
          <span className="mr-3 font-display text-xl font-extrabold tracking-tight">JOBS</span>
          {[["recommended", "Recommended"], ["liked", `Liked ${liked.size ? liked.size : ""}`], ["applied", "Applied"], ["external", "External"]].map(([k, l]) => (
            <Link key={k} href={href({ tab: k, page: "1" })} className={`border-b-2 px-3 pb-2 ${tab === k ? "border-blue text-ink" : "border-transparent text-muted"}`}>{l}</Link>
          ))}
          <form className="ml-auto pb-2" action="/app"><input name="q" defaultValue={sp.q} placeholder="Search title, company, city" className="h-9 w-64 rounded-lg border border-line bg-ground px-3 text-sm font-normal outline-none focus:border-blue" /></form>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-6 pt-3 text-xs font-semibold">
          {LEVELS.map(([k, l]) => <Link key={k} href={href({ level: sp.level === k ? "" : k, page: "1" })} className={`rounded-full border px-3 py-1.5 ${sp.level === k ? "border-ink bg-ink text-white" : "border-line bg-surface text-text"}`}>{l}</Link>)}
          <span className="mx-1 h-5 w-px bg-line" />
          {FIELDS.map(([k, l]) => <Link key={k} href={href({ field: sp.field === k ? "" : k, page: "1" })} className={`rounded-full border px-3 py-1.5 ${sp.field === k ? "border-ink bg-ink text-white" : "border-line bg-surface text-text"}`}>{l}</Link>)}
          <span className="mx-1 h-5 w-px bg-line" />
          <Link href={href({ remote: sp.remote === "remote" ? "" : "remote", page: "1" })} className={`rounded-full border px-3 py-1.5 ${sp.remote === "remote" ? "border-ink bg-ink text-white" : "border-line bg-surface text-text"}`}>Remote</Link>
          <Link href={href({ remote: sp.remote === "local" ? "" : "local", page: "1" })} className={`rounded-full border px-3 py-1.5 ${sp.remote === "local" ? "border-ink bg-ink text-white" : "border-line bg-surface text-text"}`}>On-site / hybrid</Link>
        </div>

        <div className="flex items-center justify-between px-6 pb-2 pt-3 text-[13px] text-text">
          <div><span className="font-bold text-ink">{items.length.toLocaleString()} results</span> for your profile · <span className="font-semibold text-blue">{feed.newToday} new since yesterday</span> · all verified live</div>
          <div className="text-xs text-muted">Sorted by fit</div>
        </div>

        {tab === "applied" || tab === "external" ? (
          <Empty title={tab === "applied" ? "Nothing applied yet." : "No external jobs yet."} body={tab === "applied" ? "When you apply through Rails, or the extension sees you submit, it lands here with its stage." : "Paste any posting URL and Rails scores it like the rest. Coming in the next build."} />
        ) : pageItems.length === 0 ? (
          <Empty title={items.length === 0 && feed.total === 0 ? "Nothing matches yet." : "No jobs on this page."} body={feed.total === 0 ? "Try clearing a filter. If the feed is empty with no filters, the tagger is still catching up on new postings; check back in 15 minutes." : "Go back a page or clear a filter."} />
        ) : (
          <ul className="flex flex-col gap-3 px-6 pb-10">
            {pageItems.map(({ job, tags, score, isNew, ageDays }) => {
              const pay = payLabel(tags, job);
              return (
                <li key={job.id} className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(11,27,58,0.04)] md:grid-cols-[1fr_250px]">
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                      {isNew && <span className="rounded bg-ink px-1.5 py-0.5 text-white">New</span>}
                      <span className="rounded bg-blue-chip px-1.5 py-0.5 text-blue-chip-text">{tags.level.replace("_", " ")}</span>
                      {tags.remote !== "unknown" && <span className="rounded bg-light px-1.5 py-0.5 text-text">{tags.remote}</span>}
                      {tags.clearanceRequired !== "none" && tags.clearanceRequired !== "unknown" && <span className="rounded bg-amber-chip px-1.5 py-0.5 text-amber-chip-text">{tags.clearanceRequired.replace("_", " ")} clearance</span>}
                      {tags.hasOnlineAssessment && <span className="rounded bg-light px-1.5 py-0.5 text-text">OA first</span>}
                      <span className="text-muted">{ageLabel(ageDays)}</span>
                    </div>
                    <div>
                      <a href={job.url} target="_blank" rel="noopener" className="font-display text-[17px] font-extrabold leading-tight tracking-tight text-ink hover:text-blue">{job.title}</a>
                      <div className="text-sm text-text">{job.companies?.name}{job.location ? ` · ${job.location}` : ""}{pay ? ` · ${pay}` : ""}</div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[12px] font-semibold">
                      {score.matchedSkills.slice(0, 4).map((k) => <span key={k} className="rounded-md bg-green-chip px-2 py-1 text-green-chip-text">✓ {k}</span>)}
                      {score.missingRequired.slice(0, 2).map((k) => <span key={k} className="rounded-md bg-amber-chip px-2 py-1 text-amber-chip-text">! {k} not on your profile</span>)}
                      {score.hardBlocks.map((b) => <span key={b} className="rounded-md bg-red-chip px-2 py-1 text-red-chip-text">✗ {b}</span>)}
                    </div>
                    <div className="mt-auto flex items-center gap-2 pt-1">
                      <a href={job.apply_url} target="_blank" rel="noopener" className="rounded-full bg-orange px-4 py-2 text-[13px] font-extrabold text-ink">Apply now</a>
                      <form action={likeJob}><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="fit" value={score.fit} /><input type="hidden" name="band" value={score.band} /><input type="hidden" name="liked" value={liked.has(job.id) ? "0" : "1"} />
                        <button className={`rounded-full border px-3 py-2 text-[13px] font-semibold ${liked.has(job.id) ? "border-ink bg-ink text-white" : "border-line text-text"}`}>{liked.has(job.id) ? "Liked" : "Like"}</button></form>
                      <form action={hideJob}><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="fit" value={score.fit} /><input type="hidden" name="band" value={score.band} />
                        <button className="rounded-full px-3 py-2 text-[13px] font-semibold text-muted hover:text-ink">Hide</button></form>
                      <span className="ml-auto text-[11px] text-dim">{job.companies?.ats}</span>
                    </div>
                  </div>
                  <MatchPanel score={score} compact />
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

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-6 my-6 rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center">
      <div className="font-display text-lg font-extrabold">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text">{body}</p>
    </div>
  );
}
