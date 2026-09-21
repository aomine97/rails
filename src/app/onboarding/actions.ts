"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extractResumeText, MAX_RESUME_BYTES } from "@/lib/profile/extract";
import { normalizeParsed, parseResume } from "@/lib/profile/parse";
import { CanonicalProfile, skillKey } from "@/lib/schemas/profile";

export type UploadState = { error?: string };

export async function uploadResume(_prev: UploadState, form: FormData): Promise<UploadState> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");
  const file = form.get("resume");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file first." };
  if (file.size > MAX_RESUME_BYTES) return { error: "Keep it under 5 MB." };
  let text: string, kind: "pdf" | "docx";
  try { ({ text, kind } = await extractResumeText(await file.arrayBuffer(), file.type, file.name)); }
  catch (e) { return { error: (e as Error).message }; }

  const admin = supabaseAdmin();
  const path = `${user.id}/base-${Date.now()}.${kind}`;
  const { error: upErr } = await admin.storage.from("resumes").upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) return { error: `Could not store the file: ${upErr.message}` };

  let profile;
  try { profile = normalizeParsed(await parseResume(text, user.email ?? ""), user.email ?? ""); }
  catch { return { error: "We couldn't read that resume into a profile. Try a simpler layout (no columns or tables) and upload again." }; }

  const { error: rErr } = await admin.from("resumes").insert({ user_id: user.id, kind: "base", storage_path: path, text_content: text });
  if (rErr) return { error: rErr.message };
  const { error: pErr } = await admin.from("profiles").update({ canonical: profile, canonical_version: 1, full_name: profile.name || undefined }).eq("id", user.id);
  if (pErr) return { error: pErr.message };
  redirect("/onboarding/confirm");
}

export type ConfirmState = { error?: string };

/** The confirm screen posts the edited profile as JSON. Everything the user typed is marked source: "user". */
export async function confirmProfile(_prev: ConfirmState, form: FormData): Promise<ConfirmState> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding/confirm");
  let incoming: unknown;
  try { incoming = JSON.parse(String(form.get("profile") ?? "")); } catch { return { error: "Something went wrong reading the form. Reload and try again." }; }
  const parsed = CanonicalProfile.safeParse(incoming);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  const p = parsed.data;
  p.skills = p.skills.map((s) => ({ ...s, key: skillKey(s.name) }));
  p.certifications = p.certifications.map((c) => ({ ...c, key: skillKey(c.name) }));
  if (form.get("attest") !== "on") return { error: "Tick the box to confirm this is true and yours." };
  const admin = supabaseAdmin();
  const { data: cur } = await admin.from("profiles").select("canonical_version").eq("id", user.id).single();
  const { error } = await admin.from("profiles").update({ canonical: p, canonical_version: (cur?.canonical_version ?? 0) + 1, full_name: p.name, onboarding_done: true }).eq("id", user.id);
  if (error) return { error: error.message };
  // Came from "Fix these on my profile" (resume score) or a job page: go straight back; the score recomputes on load.
  const next = String(form.get("next") ?? ""); redirect(/^\/app(\/|$)/.test(next) ? next : "/app");
}
