import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extUser, CORS, preflight } from "@/lib/ext/auth";
import { findJobByUrl } from "@/lib/ext/jobinfo";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** POST {url, jobId?, title, company} -> the tracker row moves to "applied". The user told us; Rails never submits. */
export async function POST(req: Request) {
  const u = await extUser(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  const body = (await req.json().catch(() => null)) as { url?: string; jobId?: string | null; title?: string; company?: string } | null;
  if (!body?.url) return NextResponse.json({ error: "url required" }, { status: 400, headers: CORS });
  const db = supabaseAdmin();
  const job = body.jobId ? { id: body.jobId } : await findJobByUrl(db, body.url).catch(() => null);
  const now = new Date().toISOString();
  const row = { user_id: u.id, job_id: job?.id ?? null, title: (body.title ?? "Application").slice(0, 200), company_name: (body.company ?? "").slice(0, 120), url: body.url.slice(0, 500), stage: "applied", via: "rails_autofill", applied_at: now, last_activity_at: now };
  const { data: existing } = job?.id ? await db.from("applications").select("id,stage").eq("user_id", u.id).eq("job_id", job.id).maybeSingle() : await db.from("applications").select("id,stage").eq("user_id", u.id).eq("url", row.url).maybeSingle();
  if (existing) { const keep = ["oa", "interview", "offer"].includes(existing.stage) ? {} : { stage: "applied", applied_at: now }; await db.from("applications").update({ ...keep, last_activity_at: now }).eq("id", existing.id); }
  else await db.from("applications").insert(row);
  return NextResponse.json({ ok: true }, { headers: CORS });
}
