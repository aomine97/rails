import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPay } from "@/lib/match/country";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { JobTags } from "@/lib/jobs/tags";
import { scoreJob } from "@/lib/match/score";

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://rails-psi.vercel.app";

export const normUrl = (u: string) => { try { const x = new URL(u); x.hash = ""; for (const k of [...x.searchParams.keys()]) if (/^(utm_|gh_src|gh_jid$|lever-|source$|src$|ref$|iis|mode$)/i.test(k) && k !== "gh_jid") x.searchParams.delete(k); return x.href.replace(/\/$/, ""); } catch { return u; } };

/** Find the job row for a page URL: exact url/apply_url, then the posting id in the path against external_id / url. */
export async function findJobByUrl(db: SupabaseClient, raw: string) {
  const url = normUrl(raw);
  const idGuess = url.match(/\/(?:jobs?|posting|postings|req|requisition|opportunities|careers)\/([A-Za-z0-9_-]{4,})/)?.[1] ?? url.match(/[?&]gh_jid=(\d+)/)?.[1] ?? url.match(/\/([A-Za-z0-9_-]{6,})\/?$/)?.[1] ?? null;
  const sel = "id,title,location,url,apply_url,tags,external_id,posted_at,first_seen_at,source,remote,pay_min,pay_max,pay_period,pay_currency,companies(name,domain,logo_url)";
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
  // "See your difference": what the posting asks for vs what the profile shows, before any credit is spent.
  const have = new Set(me.success ? me.data.skills.map((sk) => sk.key) : []);
  const wanted = tags.success ? [...tags.data.requiredSkills.map((k) => ({ k, required: true })), ...tags.data.preferredSkills.map((k) => ({ k, required: false }))] : [];
  const keywords = { matched: wanted.filter((w) => have.has(w.k)).map((w) => w.k), missing: wanted.filter((w) => !have.has(w.k)).map((w) => ({ key: w.k, required: w.required })) };
  const titleWords = new Set<string>(String(job.title).toLowerCase().split(/[^a-z0-9+#]+/).filter((w: string) => w.length > 2 && !["and", "the", "for", "intern", "internship", "summer", "2026", "2027", "graduate", "new", "grad"].includes(w)));
  const mine = me.success ? [...me.data.targetRoles, me.data.headline ?? "", ...me.data.experience.map((e) => e.title)].join(" ").toLowerCase() : "";
  const titleHits = [...titleWords].filter((w) => mine.includes(w));
  const titleMatch = titleWords.size === 0 ? "unknown" : titleHits.length >= Math.ceil(titleWords.size / 2) ? "strong" : titleHits.length > 0 ? "partial" : "none";
  return {
    keywords, titleMatch, yourTitle: me.success ? (me.data.targetRoles[0] ?? me.data.headline ?? me.data.experience[0]?.title ?? null) : null,
    level: tags.success ? tags.data.level : null, field: tags.success ? tags.data.field : null, sub: score?.sub ?? null,
    postedAt: (job as unknown as { posted_at?: string | null; first_seen_at?: string | null }).posted_at ?? (job as unknown as { first_seen_at?: string | null }).first_seen_at ?? null,
    source: (job as unknown as { source?: string | null }).source ?? null, remote: (job as unknown as { remote?: boolean | null }).remote ?? null,
    pay: (() => { const j = job as unknown as { pay_min?: number | null; pay_max?: number | null; pay_period?: string | null; pay_currency?: string | null }; return formatPay(j.pay_min ?? null, j.pay_max ?? null, j.pay_currency ?? "USD", j.pay_period === "hour" ? "hour" : "year"); })(),
    id: job.id, title: job.title, company: (job.companies as unknown as { name: string } | null)?.name ?? "", companyDomain: (job.companies as unknown as { domain?: string | null } | null)?.domain ?? null, companyLogo: (job.companies as unknown as { logo_url?: string | null } | null)?.logo_url ?? null, location: job.location, fit: score?.fit ?? null, band: score?.band ?? null,
    requirements: score?.requirements ?? [], hardBlocks: score?.hardBlocks ?? [], softNotes: score?.softNotes ?? [], tagged: tags.success && !!job.tags,
    resume: resume?.text_content ?? null, resumeScore: resume?.score ?? null, coverLetter: app?.cover_letter ?? null, stage: app?.stage ?? null,
    detailUrl: `${SITE()}/app/jobs/${job.id}`,
  };
}
