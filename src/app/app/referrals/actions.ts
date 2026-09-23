"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { planOf } from "@/lib/billing/entitlements";
import { LIMITS } from "@/lib/billing/plans";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { draftNote } from "@/lib/referrals/people";

const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const RELATIONS = ["alum", "recruiter", "team", "other"], CHANNELS = ["linkedin", "email", "other"], STATUSES = ["to_ask", "asked", "replied", "referred", "no_reply"];
const NUDGE_DAYS = 6;

async function me() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/referrals");
  return { supabase, user };
}
const back = (company?: string) => { revalidatePath("/app/referrals"); if (company) redirect(`/app/referrals?company=${encodeURIComponent(company)}`); };

export async function addContact(form: FormData) {
  const { supabase, user } = await me();
  const company = str(form, "company", 120), name = str(form, "name", 120);
  if (!company || !name) return;
  const relation = RELATIONS.includes(str(form, "relation")) ? str(form, "relation") : "other";
  const channel = CHANNELS.includes(str(form, "channel")) ? str(form, "channel") : "linkedin";
  const link = str(form, "link", 500);
  await supabase.from("referral_contacts").insert({ user_id: user.id, company, name, role: str(form, "role", 160) || null, link: /^https?:\/\//.test(link) ? link : null, relation, channel, job_id: str(form, "job", 64) || null });
  back(company);
}

/** Free plan: one drafted note a day (LIMITS.referralRevealsPerDay). */
export async function draftFor(form: FormData) {
  const { supabase, user } = await me();
  const id = str(form, "id", 64);
  const { data: c } = await supabase.from("referral_contacts").select("id,company,name,role,relation,channel,job_id,jobs(title)").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!c) return;
  const plan = await planOf(supabase, user.id);
  const cap = LIMITS[plan].referralRevealsPerDay;
  if (cap !== "unlimited") {
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase.from("referral_contacts").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("drafted_at", since.toISOString());
    if ((count ?? 0) >= cap) redirect(`/app/referrals?company=${encodeURIComponent(c.company)}&limit=1`);
  }
  const { data: p } = await supabase.from("profiles").select("canonical").eq("id", user.id).single();
  const profile = CanonicalProfile.safeParse(p?.canonical); if (!profile.success) redirect("/onboarding");
  const job = (c as unknown as { jobs: { title: string } | null }).jobs;
  try {
    const draft = await draftNote({ profile: profile.data, company: c.company, role: job?.title ?? null, person: { name: c.name, role: c.role, relation: c.relation }, channel: c.channel as "linkedin" | "email" | "other" });
    await supabase.from("referral_contacts").update({ draft, drafted_at: new Date().toISOString() }).eq("id", c.id);
  } catch { /* leave it undrafted; the button stays */ }
  back(c.company);
}

export async function saveDraft(form: FormData) {
  const { supabase, user } = await me();
  const id = str(form, "id", 64);
  const { data } = await supabase.from("referral_contacts").update({ draft: str(form, "draft", 1500) }).eq("id", id).eq("user_id", user.id).select("company").maybeSingle();
  back(data?.company);
}

/** Marking "asked" schedules the nudge; later statuses clear it. */
export async function setContactStatus(form: FormData) {
  const { supabase, user } = await me();
  const id = str(form, "id", 64), status = str(form, "status");
  if (!STATUSES.includes(status)) return;
  const now = new Date();
  const patch: Record<string, unknown> = { status };
  if (status === "asked") { patch.asked_at = now.toISOString(); patch.next_nudge_at = new Date(now.getTime() + NUDGE_DAYS * 86_400_000).toISOString(); }
  else if (status !== "to_ask") patch.next_nudge_at = null;
  const { data } = await supabase.from("referral_contacts").update(patch).eq("id", id).eq("user_id", user.id).select("company").maybeSingle();
  back(data?.company);
}

export async function removeContact(form: FormData) {
  const { supabase, user } = await me();
  await supabase.from("referral_contacts").delete().eq("id", str(form, "id", 64)).eq("user_id", user.id);
  back();
}
