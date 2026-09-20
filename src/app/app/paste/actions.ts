"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchPosting, hostToName } from "@/lib/jobs/paste";
import { tagJob } from "@/lib/jobs/tagger";
import { detectAts } from "@/lib/jobs/detect";
import { adapters } from "@/lib/ats";

export type PasteState = { error?: string };

/** Paste a URL (or URL + description text). Fetch, tag now, add to the feed as source=paste, open the detail page. */
export async function pastePosting(_prev: PasteState, form: FormData): Promise<PasteState> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/paste");
  const url = String(form.get("url") ?? "").trim();
  const pastedText = String(form.get("text") ?? "").trim();
  if (!/^https?:\/\//.test(url)) return { error: "Paste the full link, starting with https://" };
  let posting;
  try { posting = await fetchPosting(url); }
  catch (e) {
    if (pastedText.length < 300) return { error: (e as Error).message };
    posting = { url, applyUrl: url, title: String(form.get("title") ?? "").trim() || "Pasted posting", company: hostToName(url), text: pastedText };
  }
  const admin = supabaseAdmin();
  const det = detectAts(url);
  const { ats, slug } = det;
  // Company discovery from a pasted link: if the URL identifies a feed we can poll, the company goes live for everyone.
  const pollable = !!adapters[ats] && (!!slug || ats === "oracle");
  const { data: byFeed } = slug ? await admin.from("companies").select("id,active").eq("ats", ats).eq("slug", slug).limit(1).maybeSingle() : { data: null };
  const { data: byName } = byFeed ? { data: null } : await admin.from("companies").select("id,active,ats,slug").ilike("name", posting.company).limit(1).maybeSingle();
  let companyId = (byFeed?.id ?? byName?.id) as string | undefined;
  if (!companyId) {
    const { data: created, error } = await admin.from("companies").insert({ name: posting.company, ats, slug: slug ?? null, tenant: det.tenant ?? null, wdn: det.wdn ?? null, careers_url: new URL(url).origin, active: pollable }).select("id").single();
    if (error || !created) return { error: "Could not save the company." };
    companyId = created.id;
  } else if (pollable && byName && (byName.ats === "unknown" || !byName.slug)) {
    // We knew the name but not the feed; the pasted link just told us.
    await admin.from("companies").update({ ats, slug, tenant: det.tenant ?? null, wdn: det.wdn ?? null, careers_url: new URL(url).origin, active: true }).eq("id", companyId);
  }
  let tags = null;
  try { tags = await tagJob({ title: posting.title, company: posting.company, location: null, descriptionText: posting.text }); } catch { /* shows untagged; cron will retry */ }
  const row = { company_id: companyId, ats, external_id: `paste:${user.id}:${url.slice(0, 200)}`, title: posting.title, location: null, remote: tags?.remote === "remote" ? true : null,
    description_text: posting.text, url, apply_url: posting.applyUrl, source: "paste", tags, tagged_at: tags ? new Date().toISOString() : null, last_verified_at: new Date().toISOString() };
  const { data: job, error } = await admin.from("jobs").upsert(row, { onConflict: "company_id,external_id" }).select("id").single();
  if (error || !job) return { error: error?.message ?? "Could not save the posting." };
  if (tags) {
    const skills = [...tags.requiredSkills.map((k) => ({ job_id: job.id, skill_key: k, required: true })), ...tags.preferredSkills.map((k) => ({ job_id: job.id, skill_key: k, required: false }))];
    if (skills.length) await admin.from("job_skills").upsert(skills, { onConflict: "job_id,skill_key" });
  }
  await admin.from("matches").upsert({ user_id: user.id, job_id: job.id, fit: 0, band: "stretch", sub: {}, canonical_version: 0 }, { onConflict: "user_id,job_id" });
  redirect(`/app/jobs/${job.id}`);
}
