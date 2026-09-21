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
  const d = parsed.data;
  const DEGREE: Record<string, string> = { AAS: "Associate's Degree", AS: "Associate's Degree", AA: "Associate's Degree", BS: "Bachelor's Degree", BA: "Bachelor's Degree", BAS: "Bachelor's Degree", BSC: "Bachelor's Degree", MS: "Master's Degree", MA: "Master's Degree", MBA: "Master's Degree", PHD: "Doctorate" };
  return NextResponse.json({
    name: p.full_name, email: p.email, plan, credits: plan === "free" ? credits?.balance ?? 3 : "unlimited", fields: fillFields(d), skills: d.skills.map((s) => s.name),
    // full lists for multi-row forms (Workday "Add Another"): jobs and internships first, then projects; every education entry
    experience: d.experience.filter((e) => e.kind === "job" || e.kind === "internship").concat(d.experience.filter((e) => e.kind !== "job" && e.kind !== "internship")).map((e) => ({ title: e.title, org: e.org, kind: e.kind, start: e.start, end: e.end, current: !e.end, bullets: e.bullets })),
    education: d.education.map((e) => ({ school: e.school, degree: e.degree, degreeName: DEGREE[(e.degree ?? "").replace(/[.\s]/g, "").toUpperCase()] ?? e.degree, field: e.field, startYear: e.startYear, gradYear: e.gradYear, gpa: e.gpa })),
  }, { headers: CORS });
}
