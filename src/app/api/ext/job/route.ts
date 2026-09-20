import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extUser, CORS, preflight } from "@/lib/ext/auth";
import { findJobByUrl, jobInfo } from "@/lib/ext/jobinfo";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** ?url=<current tab> -> the Rails job on this page, if we have it: fit, requirement checklist, tailored resume text, cover letter. */
export async function GET(req: Request) {
  const u = await extUser(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  const raw = new URL(req.url).searchParams.get("url") ?? "";
  const db = supabaseAdmin();
  const job = await findJobByUrl(db, raw);
  if (!job) return NextResponse.json({ job: null }, { headers: CORS });
  return NextResponse.json({ job: await jobInfo(db, u.id, job) }, { headers: CORS });
}
