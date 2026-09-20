import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobTags } from "./tags";

/** Write tags + job_skills for one job. Shared by the 10-minute cron and the nightly batch collector. */
export async function applyTags(db: SupabaseClient, jobId: string, tags: JobTags) {
  await db.from("jobs").update({ tags, tagged_at: new Date().toISOString(), remote: tags.remote === "unknown" ? undefined : tags.remote === "remote" }).eq("id", jobId);
  const skills = [...tags.requiredSkills.map((k) => ({ job_id: jobId, skill_key: k, required: true })), ...tags.preferredSkills.map((k) => ({ job_id: jobId, skill_key: k, required: false }))];
  if (skills.length) await db.from("job_skills").upsert(skills, { onConflict: "job_id,skill_key" });
}
