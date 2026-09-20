import type { SupabaseClient } from "@supabase/supabase-js";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { JobTags } from "@/lib/jobs/tags";
import { scoreJob } from "@/lib/match/score";

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://rails-psi.vercel.app";

export const normUrl = (u: string) => { try { const x = new URL(u); x.hash = ""; for (const k of [...x.searchParams.keys()]) if (/^(utm_|gh_src|gh_jid$|lever-|source$|src$|ref$|iis|mode$)/i.test(k) && k !== "gh_jid") x.searchParams.delete(k); return x.href.replace(/\/$/, ""); } catch { return u; } };

/** Find the job row for a page URL: exact url/apply_url, then the posting id in the path against external_id / url. */
export async function findJobByUrl(db: SupabaseClient, raw: string) {
  const url = normUrl(raw);
  const idGuess = url.match(/\/(?:jobs?|posting|postings|req|requisition|opportunities|careers)\/([A-Za-z0-9_-]{4,})/)?.[1] ?? url.match(/[?&]gh_jid=(\d+)/)?.[1] ?? url.match(/\/([A-Za-z0-9_-]{6,})\/?$/)?.[1] ?? null;
  const sel = "id,title,location,url,apply_url,tags,external_id,companies(name)";
  const { data: exact } = await db.from("jobs").select(sel).is("closed_at", null).or(`url.eq.${url},apply_url.eq.${url},url.eq.${url}/,apply_url.eq.${url}/`).limit(1);
  if (exact?.[0]) return exact[0];
  if (idGuess) {
    const { data: byId } = await db.from("jobs").select(sel).is("closed_at", null).or(`external_id.eq.${idGuess},url.ilike.%/${idGuess}%,apply_url.ilike.%/${idGuess}%`).limit(5);
    const host = (() => { try { return new URL(url).hostname; } catch { return ""; } })();
    const hit = (byId ?? []).find((r) => (r.url ?? "").includes(host) || (r.apply_url ?? "").includes(host)) ?? byId?.[0];
    if (hit) return hit;
  }
  return null;
}

export async function jobInfo(db: SupabaseClient, userId: string, job: NonNullable<Awaited<ReturnType<typeof findJobByUrl>>>) {
  const [{ data: p }, { data: resume }, { data: app }] = await Promise.all([
    db.from("profiles").select("canonical").eq("id", userId).single(),
    db.from("resumes").select("text_content,score").eq("user_id", userId).eq("job_id", job.id).eq("kind", "tailored").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("applications").select("stage,cover_letter").eq("user_id", userId).eq("job_id", job.id).maybeSingle(),
  ]);
  const me = CanonicalProfile.safeParse(p?.canonical); const tags = JobTags.safeParse(job.tags);
  const score = me.success && tags.success ? scoreJob(me.data, tags.data, { title: job.title, location: job.location }) : null;
  return {
    id: job.id, title: job.title, company: (job.companies as unknown as { name: string } | null)?.name ?? "", location: job.location, fit: score?.fit ?? null, band: score?.band ?? null,
    requirements: score?.requirements ?? [], hardBlocks: score?.hardBlocks ?? [], softNotes: score?.softNotes ?? [], tagged: tags.success && !!job.tags,
    resume: resume?.text_content ?? null, resumeScore: resume?.score ?? null, coverLetter: app?.cover_letter ?? null, stage: app?.stage ?? null,
    detailUrl: `${SITE()}/app/jobs/${job.id}`,
  };
}
