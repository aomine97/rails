import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { JobTags } from "@/lib/jobs/tags";
import { scoreJob } from "@/lib/match/score";
import { extUser, CORS, preflight } from "@/lib/ext/auth";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

const norm = (u: string) => { try { const x = new URL(u); x.hash = ""; for (const k of [...x.searchParams.keys()]) if (/^(utm_|gh_src|lever-|source|src|ref)/i.test(k)) x.searchParams.delete(k); return x.href.replace(/\/$/, ""); } catch { return u; } };

/** ?url=<current tab> -> the Rails job on this page, if we have it: fit, requirement checklist, tailored resume text, cover letter. */
export async function GET(req: Request) {
  const u = await extUser(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  const raw = new URL(req.url).searchParams.get("url") ?? "";
  const url = norm(raw);
  const db = supabaseAdmin();
  const host = (() => { try { return new URL(url).hostname; } catch { return ""; } })();
  // match on url/apply_url (normalized both sides), then on a numeric/opaque id in the path against external_id
  const idGuess = url.match(/\/(?:jobs?|job|posting|postings|req|requisition)\/([A-Za-z0-9_-]{4,})/)?.[1] ?? url.match(/\/([A-Za-z0-9_-]{6,})\/?$/)?.[1] ?? null;
  let q = db.from("jobs").select("id,title,location,url,apply_url,tags,external_id,companies(name)").is("closed_at", null).limit(20);
  q = idGuess ? q.or(`url.ilike.%${host}%,apply_url.ilike.%${host}%,external_id.eq.${idGuess}`) : q.or(`url.ilike.%${host}%,apply_url.ilike.%${host}%`);
  const { data: rows } = await q;
  const job = (rows ?? []).find((r) => norm(r.url ?? "") === url || norm(r.apply_url ?? "") === url) ?? (idGuess ? (rows ?? []).find((r) => r.external_id === idGuess || (r.url ?? "").includes(idGuess)) : undefined);
  if (!job) return NextResponse.json({ job: null }, { headers: CORS });
  const [{ data: p }, { data: resume }, { data: app }] = await Promise.all([
    db.from("profiles").select("canonical").eq("id", u.id).single(),
    db.from("resumes").select("text_content,score").eq("user_id", u.id).eq("job_id", job.id).eq("kind", "tailored").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("applications").select("stage,cover_letter").eq("user_id", u.id).eq("job_id", job.id).maybeSingle(),
  ]);
  const me = CanonicalProfile.safeParse(p?.canonical); const tags = JobTags.safeParse(job.tags);
  const score = me.success && tags.success ? scoreJob(me.data, tags.data, { title: job.title, location: job.location }) : null;
  return NextResponse.json({
    job: { id: job.id, title: job.title, company: (job.companies as unknown as { name: string } | null)?.name ?? "", location: job.location, fit: score?.fit ?? null, band: score?.band ?? null,
      requirements: score?.requirements ?? [], hardBlocks: score?.hardBlocks ?? [], resume: resume?.text_content ?? null, resumeScore: resume?.score ?? null, coverLetter: app?.cover_letter ?? null, stage: app?.stage ?? null,
      detailUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://rails-psi.vercel.app"}/app/jobs/${job.id}` },
  }, { headers: CORS });
}
