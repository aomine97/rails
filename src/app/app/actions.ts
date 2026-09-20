"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CanonicalProfile, skillKey } from "@/lib/schemas/profile";

async function me() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

async function upsertMatch(jobId: string, patch: { liked?: boolean; hidden?: boolean }, fit: number, band: string) {
  const { supabase, user } = await me();
  if (!user) return;
  const { data: prof } = await supabase.from("profiles").select("canonical_version").eq("id", user.id).single();
  await supabase.from("matches").upsert({ user_id: user.id, job_id: jobId, fit, band, sub: {}, canonical_version: prof?.canonical_version ?? 0, ...patch }, { onConflict: "user_id,job_id" });
  revalidatePath("/app"); revalidatePath("/app/jobs/[id]", "page");
}

export async function likeJob(form: FormData) {
  await upsertMatch(String(form.get("jobId")), { liked: form.get("liked") === "1" }, Number(form.get("fit")), String(form.get("band")));
}
export async function hideJob(form: FormData) {
  await upsertMatch(String(form.get("jobId")), { hidden: form.get("hidden") !== "0" }, Number(form.get("fit")), String(form.get("band")));
}

/** "+ C++" on a card: the user says they have it. Added to the profile as source:user; every score updates on the next load. */
export async function addSkillToProfile(form: FormData) {
  const { user } = await me();
  if (!user) return;
  const name = String(form.get("skill") ?? "").trim().slice(0, 60);
  if (!name) return;
  const admin = supabaseAdmin();
  const { data: prof } = await admin.from("profiles").select("canonical,canonical_version").eq("id", user.id).single();
  const parsed = CanonicalProfile.safeParse(prof?.canonical);
  if (!parsed.success) return;
  const p = parsed.data; const key = skillKey(name);
  if (p.skills.some((s) => s.key === key)) return;
  p.skills.push({ name, key, level: "working", evidence: "Added by you from a job card", source: "user" });
  await admin.from("profiles").update({ canonical: p, canonical_version: (prof?.canonical_version ?? 0) + 1 }).eq("id", user.id);
  revalidatePath("/app"); revalidatePath("/app/jobs/[id]", "page");
}

/** After "Apply now" opens the posting, the card asks "Did you apply?". Yes -> application row, stage applied. */
export async function markApplied(form: FormData) {
  const { supabase, user } = await me();
  if (!user) return;
  const jobId = String(form.get("jobId")); const applied = form.get("applied") === "1";
  const { data: existing } = await supabase.from("applications").select("id").eq("user_id", user.id).eq("job_id", jobId).maybeSingle();
  const row = { user_id: user.id, job_id: jobId, title: String(form.get("title") ?? ""), company_name: String(form.get("company") ?? ""), url: String(form.get("url") ?? ""),
    stage: applied ? "applied" : "saved", via: "manual", applied_at: applied ? new Date().toISOString() : null, last_activity_at: new Date().toISOString() };
  if (existing) await supabase.from("applications").update(row).eq("id", existing.id);
  else await supabase.from("applications").insert(row);
  revalidatePath("/app"); revalidatePath("/app/jobs/[id]", "page");
}
