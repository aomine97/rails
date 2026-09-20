"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runTailor } from "@/lib/tailor/run";

export type TailorState = { error?: string; locked?: { refillAt: string | null } };

export async function tailorResume(_prev: TailorState, form: FormData): Promise<TailorState> {
  const jobId = String(form.get("jobId"));
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/jobs/${jobId}/tailor`);
  const r = await runTailor(supabaseAdmin(), user.id, jobId);
  if (!r.ok) return "locked" in r ? { locked: r.locked } : { error: r.error };
  revalidatePath(`/app/jobs/${jobId}/tailor`);
  return {};
}
