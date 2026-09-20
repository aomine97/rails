"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { STAGES, type Stage } from "@/lib/tracker/stages";

async function me() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}
const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const isStage = (s: string): s is Stage => (STAGES as string[]).includes(s);
function bump() { revalidatePath("/app/tracker"); revalidatePath("/app"); }

/** Manual add: a job the user found anywhere. Company + title required; URL optional. */
export async function addApplication(form: FormData) {
  const { supabase, user } = await me(); if (!user) return;
  const company = str(form, "company", 120), title = str(form, "title", 160), url = str(form, "url", 800);
  const stage = str(form, "stage"); if (!company || !title) return;
  const st: Stage = isStage(stage) ? stage : "applied";
  const now = new Date().toISOString();
  const { data } = await supabase.from("applications").insert({
    user_id: user.id, title, company_name: company, url: url || null, stage: st, via: "manual",
    applied_at: st === "saved" || st === "prepared" ? null : now, last_activity_at: now,
  }).select("id").single();
  if (data) await supabase.from("application_events").insert({ application_id: data.id, kind: "stage_change", to_stage: st, payload: { source: "manual_add" } });
  bump();
}

/** Stage select on a card. Writes an event so the funnel and the career-center view can replay history. */
export async function setStage(form: FormData) {
  const { supabase, user } = await me(); if (!user) return;
  const id = str(form, "id", 64), to = str(form, "stage"); if (!id || !isStage(to)) return;
  const { data: cur } = await supabase.from("applications").select("stage,applied_at").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!cur || cur.stage === to) return;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { stage: to, last_activity_at: now };
  if (!cur.applied_at && to !== "saved" && to !== "prepared") patch.applied_at = now;
  // A stage change clears a done reminder unless the user typed a new one.
  if (cur.stage !== to) { patch.next_action = null; patch.next_action_at = null; }
  await supabase.from("applications").update(patch).eq("id", id).eq("user_id", user.id);
  await supabase.from("application_events").insert({ application_id: id, kind: "stage_change", from_stage: cur.stage, to_stage: to });
  bump();
}

export async function saveNote(form: FormData) {
  const { supabase, user } = await me(); if (!user) return;
  const id = str(form, "id", 64), notes = String(form.get("notes") ?? "").trim().slice(0, 4000);
  if (!id) return;
  await supabase.from("applications").update({ notes: notes || null }).eq("id", id).eq("user_id", user.id);
  await supabase.from("application_events").insert({ application_id: id, kind: "note", payload: { length: notes.length } });
  bump();
}

/** Reminder: what + when. Empty date clears it. */
export async function setReminder(form: FormData) {
  const { supabase, user } = await me(); if (!user) return;
  const id = str(form, "id", 64), what = str(form, "what", 200), when = str(form, "when", 20);
  if (!id) return;
  const at = when ? new Date(`${when}T09:00:00`).toISOString() : null;
  await supabase.from("applications").update({ next_action: at ? (what || "Follow up") : null, next_action_at: at }).eq("id", id).eq("user_id", user.id);
  await supabase.from("application_events").insert({ application_id: id, kind: "reminder", payload: { what, at } });
  bump();
}

/** "Done" on an Up-next item: clears the reminder and touches last_activity so idle rules restart. */
export async function completeFollowUp(form: FormData) {
  const { supabase, user } = await me(); if (!user) return;
  const id = str(form, "id", 64); if (!id) return;
  await supabase.from("applications").update({ next_action: null, next_action_at: null, last_activity_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
  await supabase.from("application_events").insert({ application_id: id, kind: "reminder", payload: { done: true } });
  bump();
}

export async function removeApplication(form: FormData) {
  const { supabase, user } = await me(); if (!user) return;
  const id = str(form, "id", 64); if (!id) return;
  await supabase.from("applications").delete().eq("id", id).eq("user_id", user.id);
  bump();
}
