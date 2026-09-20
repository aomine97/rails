"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { JobTags } from "@/lib/jobs/tags";
import { spendCredit } from "@/lib/billing/entitlements";
import { generateTailored, validateTailored } from "@/lib/tailor/generate";

export type TailorState = { error?: string; locked?: { refillAt: string | null } };

export async function tailorResume(_prev: TailorState, form: FormData): Promise<TailorState> {
  const jobId = String(form.get("jobId"));
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/jobs/${jobId}/tailor`);
  const admin = supabaseAdmin();
  const [{ data: prof }, { data: job }] = await Promise.all([
    admin.from("profiles").select("canonical").eq("id", user.id).single(),
    admin.from("jobs").select("id,title,description_text,tags,companies(name)").eq("id", jobId).single(),
  ]);
  const me = CanonicalProfile.safeParse(prof?.canonical); const tags = JobTags.safeParse(job?.tags);
  if (!me.success || !job) return { error: "Finish your profile first." };
  if (!tags.success) return { error: "This posting isn't tagged yet. Try again in a few minutes." };

  const credit = await spendCredit(admin, user.id, "tailor", jobId);
  if (!credit.ok) { await admin.from("paywall_events").insert({ user_id: user.id, reason: "tailor_locked", action: "shown" }); return { locked: { refillAt: credit.refillAt } }; }

  let tailored;
  try {
    const out = await generateTailored(me.data, tags.data, { title: job.title, company: (job.companies as unknown as { name: string } | null)?.name ?? "", description: job.description_text ?? "" });
    tailored = validateTailored(me.data, tags.data, out);
  } catch { return { error: "The rewrite didn't come back clean. Your credit was not charged twice; try once more." }; }

  await admin.from("resumes").insert({ user_id: user.id, kind: "tailored", job_id: jobId, text_content: tailored.text, score: tailored.coverage.after, diff: tailored });
  revalidatePath(`/app/jobs/${jobId}/tailor`);
  return {};
}
