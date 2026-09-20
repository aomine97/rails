import type { SupabaseClient } from "@supabase/supabase-js";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { JobTags } from "@/lib/jobs/tags";
import { spendCredit } from "@/lib/billing/entitlements";
import { generateTailored, validateTailored } from "./generate";

export type TailorRun = { ok: true; text: string; coverageBefore: number; coverageAfter: number; resumeId: string } | { ok: false; locked: { refillAt: string | null } } | { ok: false; error: string };

/** One tailored resume for one job: credit check, Sonnet rewrite, provenance validation, save. Used by the app page and the extension. */
export async function runTailor(admin: SupabaseClient, userId: string, jobId: string): Promise<TailorRun> {
  const [{ data: prof }, { data: job }] = await Promise.all([
    admin.from("profiles").select("canonical").eq("id", userId).single(),
    admin.from("jobs").select("id,title,description_text,tags,companies(name)").eq("id", jobId).single(),
  ]);
  const me = CanonicalProfile.safeParse(prof?.canonical); const tags = JobTags.safeParse(job?.tags);
  if (!me.success || !job) return { ok: false, error: "Finish your profile first." };
  if (!tags.success || !job.tags) return { ok: false, error: "This posting isn't tagged yet. Try again in a few minutes." };
  const credit = await spendCredit(admin, userId, "tailor", jobId);
  if (!credit.ok) { await admin.from("paywall_events").insert({ user_id: userId, reason: "tailor_locked", action: "shown" }); return { ok: false, locked: { refillAt: credit.refillAt } }; }
  let tailored;
  try {
    const out = await generateTailored(me.data, tags.data, { title: job.title, company: (job.companies as unknown as { name: string } | null)?.name ?? "", description: job.description_text ?? "" });
    tailored = validateTailored(me.data, tags.data, out);
  } catch { return { ok: false, error: "The rewrite didn't come back clean. Your credit was not charged twice; try once more." }; }
  const { data: saved } = await admin.from("resumes").insert({ user_id: userId, kind: "tailored", job_id: jobId, text_content: tailored.text, score: tailored.coverage.after, diff: tailored }).select("id").single();
  return { ok: true, text: tailored.text, coverageBefore: tailored.coverage.before, coverageAfter: tailored.coverage.after, resumeId: saved?.id ?? "" };
}
