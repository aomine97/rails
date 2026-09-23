"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { AutofillPrefs } from "@/lib/ext/prefs";

export async function savePrefs(form: FormData) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
  const s = (k: string) => { const v = String(form.get(k) ?? "").trim(); return v || null; };
  const prefs = AutofillPrefs.parse({ payText: s("payText"), relocate: s("relocate"), hoursPerWeek: s("hoursPerWeek"), essays: s("essays"), coverLetter: s("coverLetter"), resume: s("resume") });
  await supabase.from("profiles").update({ autofill_prefs: prefs }).eq("id", user.id);
  revalidatePath("/app/autofill");
}
