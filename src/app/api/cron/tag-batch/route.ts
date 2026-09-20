import { NextResponse } from "next/server";
import { cronAuth } from "../_auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { collectTagBatches, submitTagBatch } from "@/lib/jobs/batch";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Nightly: ?max=3000 submits one batch of the newest untagged jobs. ?collect=1 only collects. Collection also runs inside /api/cron/tag. */
export async function GET(req: Request) {
  const denied = cronAuth(req); if (denied) return denied;
  const db = supabaseAdmin();
  const url = new URL(req.url);
  const collected = await collectTagBatches(db, 120_000);
  if (url.searchParams.get("collect")) return NextResponse.json({ collected });
  const max = Number(url.searchParams.get("max") ?? 3000);
  const submitted = await submitTagBatch(db, max);
  return NextResponse.json({ collected, ...submitted });
}
