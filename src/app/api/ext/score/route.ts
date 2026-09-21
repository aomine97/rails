import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extUser, CORS, preflight } from "@/lib/ext/auth";
import { importPosting } from "@/lib/jobs/import";
import { findJobByUrl, jobInfo } from "@/lib/ext/jobinfo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const OPTIONS = preflight;

/** POST {url, text?} -> fetch + tag + score the page the user is on, then return the same shape as /api/ext/job. ~10-20s (one Haiku call). */
export async function POST(req: Request) {
  const u = await extUser(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  const body = (await req.json().catch(() => null)) as { url?: string; text?: string; title?: string; company?: string } | null;
  if (!body?.url) return NextResponse.json({ error: "url required" }, { status: 400, headers: CORS });
  const db = supabaseAdmin();
  const r = await importPosting(db, u.id, body.url, body.text ?? "", body.title ?? "", body.company ?? "");
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 422, headers: CORS });
  const { data: job } = await db.from("jobs").select("id,title,location,url,apply_url,tags,external_id,companies(name)").eq("id", r.jobId).single();
  if (!job) return NextResponse.json({ error: "saved but not found" }, { status: 500, headers: CORS });
  return NextResponse.json({ job: await jobInfo(db, u.id, job as unknown as NonNullable<Awaited<ReturnType<typeof findJobByUrl>>>), created: r.created }, { headers: CORS });
}
