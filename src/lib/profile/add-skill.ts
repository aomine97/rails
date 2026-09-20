import type { SupabaseClient } from "@supabase/supabase-js";
import { CanonicalProfile, skillKey } from "@/lib/schemas/profile";

/** "+ I have this": the user claims a skill. Stored as source:user with the evidence they typed (or a default). Never fabricated by us. */
export async function addSkill(admin: SupabaseClient, userId: string, name: string, evidence?: string): Promise<boolean> {
  const clean = name.trim().slice(0, 60); if (!clean) return false;
  const { data: prof } = await admin.from("profiles").select("canonical,canonical_version").eq("id", userId).single();
  const parsed = CanonicalProfile.safeParse(prof?.canonical); if (!parsed.success) return false;
  const p = parsed.data; const key = skillKey(clean);
  if (p.skills.some((s) => s.key === key)) return true;
  p.skills.push({ name: clean, key, level: "working", evidence: evidence?.trim().slice(0, 200) || "Added by you from a job", source: "user" });
  await admin.from("profiles").update({ canonical: p, canonical_version: (prof?.canonical_version ?? 0) + 1 }).eq("id", userId);
  return true;
}
