import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extUser, CORS, preflight } from "@/lib/ext/auth";
import { runLetter } from "@/lib/tailor/letter-run";
import { refillLabel } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";
export const maxDuration = 90;
export const OPTIONS = preflight;

export async function POST(req: Request) {
  const u = await extUser(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  const body = (await req.json().catch(() => null)) as { jobId?: string } | null;
  if (!body?.jobId) return NextResponse.json({ error: "jobId required" }, { status: 400, headers: CORS });
  const r = await runLetter(supabaseAdmin(), u.id, body.jobId);
  if (!r.ok) {
    if ("locked" in r) return NextResponse.json({ error: "locked", refillIn: refillLabel(r.locked.refillAt) }, { status: 402, headers: CORS });
    return NextResponse.json({ error: r.error }, { status: 422, headers: CORS });
  }
  return NextResponse.json({ letter: r.letter, sources: r.sources }, { headers: CORS });
}
