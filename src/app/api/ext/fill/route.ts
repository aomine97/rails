import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extUser, CORS, preflight } from "@/lib/ext/auth";
import { detectAts } from "@/lib/jobs/detect";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Telemetry from a fill: one row per field. This is the flywheel that turns into learned selectors. */
export async function POST(req: Request) {
  const u = await extUser(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  const body = (await req.json().catch(() => null)) as { url?: string; fields?: { key: string; selector: string | null; strategy: string; success: boolean }[]; jobId?: string } | null;
  if (!body?.url || !Array.isArray(body.fields)) return NextResponse.json({ error: "bad body" }, { status: 400, headers: CORS });
  const domain = (() => { try { return new URL(body.url!).hostname; } catch { return "unknown"; } })();
  const ats = detectAts(body.url).ats;
  const hash = Buffer.from(body.url).toString("base64url").slice(0, 40);
  const rows = body.fields.slice(0, 60).map((f) => ({ user_id: u.id, domain, ats, page_url_hash: hash, field_key: String(f.key).slice(0, 40), selector: f.selector ? String(f.selector).slice(0, 200) : null, strategy: String(f.strategy).slice(0, 20), success: !!f.success }));
  const db = supabaseAdmin();
  if (rows.length) await db.from("fill_events").insert(rows);
  // learned selectors: successes bump hits, failures bump misses
  for (const f of rows) {
    if (!f.selector) continue;
    const { data: cur } = await db.from("learned_selectors").select("hits,misses").eq("domain", domain).eq("field_key", f.field_key).eq("selector", f.selector).maybeSingle();
    await db.from("learned_selectors").upsert({ domain, field_key: f.field_key, selector: f.selector, hits: (cur?.hits ?? 0) + (f.success ? 1 : 0), misses: (cur?.misses ?? 0) + (f.success ? 0 : 1), updated_at: new Date().toISOString() });
  }
  // if this page is a known job and the user filled it, mark the application as prepared
  if (body.jobId) {
    const { data: app } = await db.from("applications").select("id,stage").eq("user_id", u.id).eq("job_id", body.jobId).maybeSingle();
    if (app && app.stage === "saved") await db.from("applications").update({ stage: "prepared", last_activity_at: new Date().toISOString() }).eq("id", app.id);
  }
  return NextResponse.json({ ok: true, recorded: rows.length }, { headers: CORS });
}

/** Selectors other users found to work on this domain, best first. */
export async function GET(req: Request) {
  const u = await extUser(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  const domain = new URL(req.url).searchParams.get("domain") ?? "";
  const { data } = await supabaseAdmin().from("learned_selectors").select("field_key,selector,hits,misses").eq("domain", domain).gt("hits", 0).order("hits", { ascending: false }).limit(200);
  const best: Record<string, string[]> = {};
  for (const r of data ?? []) if (r.hits >= r.misses) (best[r.field_key] ??= []).push(r.selector);
  return NextResponse.json({ domain, selectors: best }, { headers: CORS });
}
