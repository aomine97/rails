"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export async function saveAlertSettings(form: FormData) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
  const enabled = form.get("enabled") === "on";
  const minFit = Math.min(100, Math.max(50, Number(form.get("minFit") ?? 80) || 80));
  const where = String(form.get("where") ?? "us").slice(0, 8);
  await supabase.from("profiles").update({ alerts_enabled: enabled, alerts_min_fit: minFit, alerts_where: where }).eq("id", user.id);
  revalidatePath("/app/settings");
}
