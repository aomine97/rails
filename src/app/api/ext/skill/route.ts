import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extUser, CORS, preflight } from "@/lib/ext/auth";
import { addSkill } from "@/lib/profile/add-skill";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** POST {skill, evidence?} -> "+ I have this" from the panel. The score on every job updates on the next read. */
export async function POST(req: Request) {
  const u = await extUser(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  const body = (await req.json().catch(() => null)) as { skill?: string; evidence?: string } | null;
  if (!body?.skill) return NextResponse.json({ error: "skill required" }, { status: 400, headers: CORS });
  const ok = await addSkill(supabaseAdmin(), u.id, body.skill, body.evidence);
  return NextResponse.json({ ok }, { headers: CORS });
}
