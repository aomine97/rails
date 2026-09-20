import { NextResponse } from "next/server";
import { cronAuth } from "../_auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { UA } from "@/lib/ats/util";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Daily. Re-checks open postings not verified in 24h by URL; 404/410 or a redirect to a search page => closed. */
export async function GET(req: Request) {
  const denied = await cronAuth(req); if (denied) return denied;
  const db = supabaseAdmin();
  const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: jobs, error } = await db.from("jobs").select("id,url").is("closed_at", null)
    .or(`last_verified_at.is.null,last_verified_at.lt.${cutoff}`).order("last_verified_at", { ascending: true, nullsFirst: true }).limit(400);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let closed = 0, verified = 0;
  for (let i = 0; i < (jobs ?? []).length; i += 8) {
    await Promise.all(jobs!.slice(i, i + 8).map(async (j) => {
      const now = new Date().toISOString();
      try {
        const res = await fetch(j.url, { method: "GET", redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(10_000) });
        const gone = res.status === 404 || res.status === 410 || (res.redirected && /search|jobs\/?$|careers\/?$/i.test(new URL(res.url).pathname) && !/\d/.test(new URL(res.url).pathname));
        await db.from("jobs").update(gone ? { closed_at: now, last_verified_at: now } : { last_verified_at: now }).eq("id", j.id);
        if (gone) closed++; else verified++;
      } catch { /* network blip: leave last_verified_at alone, try tomorrow */ }
    }));
  }
  return NextResponse.json({ checked: jobs?.length ?? 0, verified, closed });
}
