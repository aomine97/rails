"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

async function upsertMatch(jobId: string, patch: { liked?: boolean; hidden?: boolean }, fit: number, band: string) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: prof } = await supabase.from("profiles").select("canonical_version").eq("id", user.id).single();
  await supabase.from("matches").upsert({ user_id: user.id, job_id: jobId, fit, band, sub: {}, canonical_version: prof?.canonical_version ?? 0, ...patch }, { onConflict: "user_id,job_id" });
  revalidatePath("/app");
}

export async function likeJob(form: FormData) {
  await upsertMatch(String(form.get("jobId")), { liked: form.get("liked") === "1" }, Number(form.get("fit")), String(form.get("band")));
}
export async function hideJob(form: FormData) {
  await upsertMatch(String(form.get("jobId")), { hidden: true }, Number(form.get("fit")), String(form.get("band")));
}
