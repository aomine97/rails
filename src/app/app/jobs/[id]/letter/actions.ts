"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runLetter } from "@/lib/tailor/letter-run";

export type LetterState = { error?: string; locked?: { refillAt: string | null } };

export async function writeLetter(_prev: LetterState, form: FormData): Promise<LetterState> {
  const jobId = String(form.get("jobId"));
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/jobs/${jobId}/letter`);
  const r = await runLetter(supabaseAdmin(), user.id, jobId);
  if (!r.ok) return "locked" in r ? { locked: r.locked } : { error: r.error };
  revalidatePath(`/app/jobs/${jobId}/letter`);
  return {};
}
