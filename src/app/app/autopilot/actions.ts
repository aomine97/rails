"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

async function me() { const supabase = await supabaseServer(); const { data: { user } } = await supabase.auth.getUser(); return { supabase, user }; }

/** Approve: the application row becomes 'prepared' and the apply companion opens with the tailored resume ready. The user still clicks Submit on the board. */
export async function approveQueued(form: FormData) {
  const { supabase, user } = await me(); if (!user) return;
  const id = String(form.get("id") ?? "");
  const { data: q } = await supabase.from("autopilot_queue").select("id,job_id,resume_id,jobs(title,url,apply_url,companies(name))").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!q) return;
  const job = q.jobs as unknown as { title: string; url: string; apply_url: string; companies: { name: string } | null } | null;
  await supabase.from("autopilot_queue").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", id);
  const { data: app } = await supabase.from("applications").select("id").eq("user_id", user.id).eq("job_id", q.job_id).maybeSingle();
  const row = { user_id: user.id, job_id: q.job_id, title: job?.title ?? "", company_name: job?.companies?.name ?? "", url: job?.apply_url ?? job?.url ?? null, stage: "prepared", via: "rails_autopilot", resume_id: q.resume_id, last_activity_at: new Date().toISOString() };
  if (app) await supabase.from("applications").update({ stage: "prepared", via: "rails_autopilot", resume_id: q.resume_id, last_activity_at: row.last_activity_at }).eq("id", app.id);
  else await supabase.from("applications").insert(row);
  revalidatePath("/app/autopilot"); revalidatePath("/app/tracker");
  redirect(`/app/jobs/${q.job_id}/apply`);
}

export async function dismissQueued(form: FormData) {
  const { supabase, user } = await me(); if (!user) return;
  await supabase.from("autopilot_queue").update({ status: "dismissed" }).eq("id", String(form.get("id") ?? "")).eq("user_id", user.id);
  revalidatePath("/app/autopilot");
}

export async function saveAutopilotSettings(form: FormData) {
  const { supabase, user } = await me(); if (!user) return;
  const enabled = form.get("enabled") === "on";
  const minFit = Math.min(100, Math.max(60, Number(form.get("minFit") ?? 80) || 80));
  await supabase.from("profiles").update({ autopilot_enabled: enabled, autopilot_min_fit: minFit }).eq("id", user.id);
  revalidatePath("/app/autopilot");
}
