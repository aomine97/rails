import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { planOf } from "@/lib/billing/entitlements";
import { extUser, CORS, preflight } from "@/lib/ext/auth";
import { fillFields } from "@/lib/ext/fields";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Who am I + what to fill. Cached by the extension; refreshed when the side panel opens. */
export async function GET(req: Request) {
  const u = await extUser(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  const db = supabaseAdmin();
  const [{ data: p }, plan, { data: credits }] = await Promise.all([
    db.from("profiles").select("full_name,email,canonical,onboarding_done").eq("id", u.id).single(),
    planOf(db, u.id),
    db.from("credits").select("balance").eq("user_id", u.id).maybeSingle(),
  ]);
  const parsed = CanonicalProfile.safeParse(p?.canonical);
  if (!p?.onboarding_done || !parsed.success) return NextResponse.json({ error: "onboarding_incomplete" }, { status: 409, headers: CORS });
  return NextResponse.json({ name: p.full_name, email: p.email, plan, credits: plan === "free" ? credits?.balance ?? 3 : "unlimited", fields: fillFields(parsed.data), skills: parsed.data.skills.map((s) => s.name) }, { headers: CORS });
}
