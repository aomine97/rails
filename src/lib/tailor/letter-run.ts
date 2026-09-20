import type { SupabaseClient } from "@supabase/supabase-js";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { JobTags } from "@/lib/jobs/tags";
import { spendCredit } from "@/lib/billing/entitlements";
import { generateLetter } from "./letter";

export type LetterRun = { ok: true; letter: string; sources: string[] } | { ok: false; locked: { refillAt: string | null } } | { ok: false; error: string };

/** One cover letter for one job: credit, Sonnet, saved on the application row. Shared by the app page and the extension. */
export async function runLetter(admin: SupabaseClient, userId: string, jobId: string): Promise<LetterRun> {
  const [{ data: prof }, { data: job }] = await Promise.all([
    admin.from("profiles").select("canonical").eq("id", userId).single(),
    admin.from("jobs").select("id,title,description_text,tags,url,companies(name)").eq("id", jobId).single(),
  ]);
  const me = CanonicalProfile.safeParse(prof?.canonical); const tags = JobTags.safeParse(job?.tags);
  if (!me.success || !job) return { ok: false, error: "Finish your profile first." };
  if (!tags.success || !job.tags) return { ok: false, error: "This posting isn't tagged yet. Try again in a few minutes." };
  const credit = await spendCredit(admin, userId, "cover_letter", jobId);
  if (!credit.ok) { await admin.from("paywall_events").insert({ user_id: userId, reason: "tailor_locked", action: "shown" }); return { ok: false, locked: { refillAt: credit.refillAt } }; }
  const company = (job.companies as unknown as { name: string } | null)?.name ?? "";
  let out;
  try { out = await generateLetter(me.data, tags.data, { title: job.title, company, description: job.description_text ?? "" }); }
  catch { return { ok: false, error: "The letter didn't come back clean. Try once more." }; }
  const { data: existing } = await admin.from("applications").select("id").eq("user_id", userId).eq("job_id", jobId).maybeSingle();
  const payload = { cover_letter: out.letter, notes: `Letter sources: ${out.sources.join(" | ")}`.slice(0, 2000), last_activity_at: new Date().toISOString() };
  if (existing) await admin.from("applications").update(payload).eq("id", existing.id);
  else await admin.from("applications").insert({ user_id: userId, job_id: jobId, title: job.title, company_name: company, url: job.url, stage: "saved", via: "manual", ...payload });
  return { ok: true, letter: out.letter, sources: out.sources };
}
