"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { JobTags } from "@/lib/jobs/tags";
import { spendCredit } from "@/lib/billing/entitlements";
import { generateLetter } from "@/lib/tailor/letter";

export type LetterState = { error?: string; locked?: { refillAt: string | null } };

export async function writeLetter(_prev: LetterState, form: FormData): Promise<LetterState> {
  const jobId = String(form.get("jobId"));
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/jobs/${jobId}/letter`);
  const admin = supabaseAdmin();
  const [{ data: prof }, { data: job }] = await Promise.all([
    admin.from("profiles").select("canonical").eq("id", user.id).single(),
    admin.from("jobs").select("id,title,description_text,tags,url,companies(name)").eq("id", jobId).single(),
  ]);
  const me = CanonicalProfile.safeParse(prof?.canonical); const tags = JobTags.safeParse(job?.tags);
  if (!me.success || !job) return { error: "Finish your profile first." };
  if (!tags.success) return { error: "This posting isn't tagged yet. Try again in a few minutes." };
  const credit = await spendCredit(admin, user.id, "cover_letter", jobId);
  if (!credit.ok) { await admin.from("paywall_events").insert({ user_id: user.id, reason: "tailor_locked", action: "shown" }); return { locked: { refillAt: credit.refillAt } }; }
  const company = (job.companies as unknown as { name: string } | null)?.name ?? "";
  let out;
  try { out = await generateLetter(me.data, tags.data, { title: job.title, company, description: job.description_text ?? "" }); }
  catch { return { error: "The letter didn't come back clean. Try once more." }; }
  // stored on the application row (created as 'saved' if none yet)
  const { data: existing } = await admin.from("applications").select("id").eq("user_id", user.id).eq("job_id", jobId).maybeSingle();
  const payload = { cover_letter: out.letter, notes: `Letter sources: ${out.sources.join(" | ")}`.slice(0, 2000), last_activity_at: new Date().toISOString() };
  if (existing) await admin.from("applications").update(payload).eq("id", existing.id);
  else await admin.from("applications").insert({ user_id: user.id, job_id: jobId, title: job.title, company_name: company, url: job.url, stage: "saved", via: "manual", ...payload });
  revalidatePath(`/app/jobs/${jobId}/letter`);
  return {};
}
