import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPosting, hostToName, type PastedPosting } from "./paste";
import { tagJob } from "./tagger";
import { detectAts } from "./detect";
import { adapters } from "../ats";

export type ImportResult = { jobId: string; created: boolean } | { error: string };

/**
 * One posting URL -> a job row the user can see (source=paste, visible only to them via `matches`).
 * Shared by the /app/paste form and the extension's "Score it". If the URL identifies a pollable feed, the company goes live for everyone.
 */
export async function importPosting(admin: SupabaseClient, userId: string, url: string, pastedText = "", title = ""): Promise<ImportResult> {
  if (!/^https?:\/\//.test(url)) return { error: "Paste the full link, starting with https://" };
  // Already in Rails from a feed? Return that row instead of duplicating.
  const clean = url.split("#")[0].replace(/\/$/, "");
  const { data: known } = await admin.from("jobs").select("id").or(`url.eq.${clean},apply_url.eq.${clean},url.eq.${clean}/,apply_url.eq.${clean}/`).is("closed_at", null).limit(1).maybeSingle();
  if (known) { await admin.from("matches").upsert({ user_id: userId, job_id: known.id, fit: 0, band: "stretch", sub: {}, canonical_version: 0 }, { onConflict: "user_id,job_id", ignoreDuplicates: true }); return { jobId: known.id, created: false }; }
  let posting: PastedPosting;
  try { posting = await fetchPosting(url); }
  catch (e) {
    if (pastedText.length < 300) return { error: (e as Error).message };
    posting = { url, applyUrl: url, title: title || "Pasted posting", company: hostToName(url), text: pastedText };
  }
  const det = detectAts(url);
  const { ats, slug } = det;
  const pollable = !!adapters[ats] && (!!slug || ats === "oracle");
  const { data: byFeed } = slug ? await admin.from("companies").select("id,active").eq("ats", ats).eq("slug", slug).limit(1).maybeSingle() : { data: null };
  const { data: byName } = byFeed ? { data: null } : await admin.from("companies").select("id,active,ats,slug").ilike("name", posting.company).limit(1).maybeSingle();
  let companyId = (byFeed?.id ?? byName?.id) as string | undefined;
  if (!companyId) {
    const { data: created, error } = await admin.from("companies").insert({ name: posting.company, ats, slug: slug ?? null, tenant: det.tenant ?? null, wdn: det.wdn ?? null, careers_url: new URL(url).origin, active: pollable }).select("id").single();
    if (error || !created) return { error: "Could not save the company." };
    companyId = created.id;
  } else if (pollable && byName && (byName.ats === "unknown" || !byName.slug)) {
    await admin.from("companies").update({ ats, slug, tenant: det.tenant ?? null, wdn: det.wdn ?? null, careers_url: new URL(url).origin, active: true }).eq("id", companyId);
  }
  let tags = null;
  try { tags = await tagJob({ title: posting.title, company: posting.company, location: null, descriptionText: posting.text }); } catch { /* shows untagged; cron retries */ }
  const row = { company_id: companyId, ats, external_id: `paste:${userId}:${url.slice(0, 200)}`, title: posting.title, location: null, remote: tags?.remote === "remote" ? true : null,
    description_text: posting.text, url, apply_url: posting.applyUrl, source: "paste", tags, tagged_at: tags ? new Date().toISOString() : null, last_verified_at: new Date().toISOString() };
  const { data: job, error } = await admin.from("jobs").upsert(row, { onConflict: "company_id,external_id" }).select("id").single();
  if (error || !job) return { error: error?.message ?? "Could not save the posting." };
  if (tags) {
    const skills = [...tags.requiredSkills.map((k) => ({ job_id: job.id, skill_key: k, required: true })), ...tags.preferredSkills.map((k) => ({ job_id: job.id, skill_key: k, required: false }))];
    if (skills.length) await admin.from("job_skills").upsert(skills, { onConflict: "job_id,skill_key" });
  }
  await admin.from("matches").upsert({ user_id: userId, job_id: job.id, fit: 0, band: "stretch", sub: {}, canonical_version: 0 }, { onConflict: "user_id,job_id" });
  return { jobId: job.id, created: true };
}
