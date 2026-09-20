import { NextResponse } from "next/server";
import { cronAuth } from "../_auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { dueCompanies, pollCompany } from "@/lib/jobs/ingest";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Hourly. Polls up to `limit` companies whose feed is stale, 4 at a time. */
export async function GET(req: Request) {
  const denied = cronAuth(req); if (denied) return denied;
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 40);
  const db = supabaseAdmin();
  const due = await dueCompanies(db, 60, limit);
  const results: unknown[] = [];
  for (let i = 0; i < due.length; i += 4) {
    results.push(...(await Promise.all(due.slice(i, i + 4).map((c) => pollCompany(db, c)))));
  }
  return NextResponse.json({ polled: due.length, results });
}
