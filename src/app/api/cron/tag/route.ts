import { NextResponse } from "next/server";
import { cronAuth } from "../_auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tagJob } from "@/lib/jobs/tagger";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Every 10 min. Tags untagged open jobs (newest first) and writes job_skills. */
export async function GET(req: Request) {
  const denied = cronAuth(req); if (denied) return denied;
  const db = supabaseAdmin();
  const { data: jobs, error } = await db.from("jobs").select("id,title,location,description_text,companies(name)")
    .is("tagged_at", null).is("closed_at", null).not("description_text", "is", null).order("first_seen_at", { ascending: false }).limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let tagged = 0, failed = 0;
  for (const j of jobs ?? []) {
    try {
      const company = (j as unknown as { companies: { name: string } | null }).companies?.name ?? "";
      const tags = await tagJob({ title: j.title, company, location: j.location, descriptionText: j.description_text! });
      await db.from("jobs").update({ tags, tagged_at: new Date().toISOString(), remote: tags.remote === "unknown" ? undefined : tags.remote === "remote" }).eq("id", j.id);
      const skills = [...tags.requiredSkills.map((k) => ({ job_id: j.id, skill_key: k, required: true })), ...tags.preferredSkills.map((k) => ({ job_id: j.id, skill_key: k, required: false }))];
      if (skills.length) await db.from("job_skills").upsert(skills, { onConflict: "job_id,skill_key" });
      tagged++;
    } catch { failed++; }
  }
  return NextResponse.json({ tagged, failed });
}
