"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { spendCredit } from "@/lib/billing/entitlements";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { generateQuestions, type InterviewQuestion, type Mode } from "@/lib/interview/questions";
import { gradeAnswer } from "@/lib/interview/feedback";
import { generateDrill, pickTopic, reviewSolution, Drill } from "@/lib/interview/oa";
import type { JobTags } from "@/lib/jobs/tags";

async function me() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/interview");
  const { data: p } = await supabase.from("profiles").select("canonical").eq("id", user.id).single();
  const parsed = CanonicalProfile.safeParse(p?.canonical);
  if (!parsed.success) redirect("/onboarding");
  return { supabase, user, profile: parsed.data };
}

type JobRow = { id: string; title: string; description_text: string | null; tags: JobTags | null; companies: { name: string } | null };

/** One credit on Free, unlimited on paid plans. Questions come from the posting + the resume. */
export async function startSession(form: FormData) {
  const { supabase, user, profile } = await me();
  const mode = (["phone", "technical", "behavioral"].includes(String(form.get("mode"))) ? String(form.get("mode")) : "phone") as Mode;
  const jobId = String(form.get("job") ?? "");
  let job: JobRow | null = null;
  if (jobId) { const { data } = await supabase.from("jobs").select("id,title,description_text,tags,companies(name)").eq("id", jobId).maybeSingle(); job = data as unknown as JobRow | null; }
  const title = job?.title ?? profile.targetRoles[0] ?? "Entry-level role in my field";
  const credit = await spendCredit(supabase, user.id, "mock_interview");
  if (!credit.ok) redirect("/app/interview?locked=1");
  let questions: InterviewQuestion[];
  try {
    questions = await generateQuestions({ profile, mode, title, company: job?.companies?.name ?? null, description: job?.description_text ?? null, requirements: (job?.tags?.requirements ?? []).map((r) => (typeof r === "string" ? r : (r as { text: string }).text)) });
  } catch { redirect("/app/interview?err=1"); }
  const { data: s } = await supabase.from("interview_sessions").insert({ user_id: user.id, job_id: job?.id ?? null, title, company: job?.companies?.name ?? null, mode, questions }).select("id").single();
  redirect(`/app/interview/${s!.id}`);
}

export type GradeState = { error?: string } | null;
export async function submitAnswer(_prev: GradeState, form: FormData): Promise<GradeState> {
  const { supabase, user, profile } = await me();
  const sessionId = String(form.get("session") ?? ""), qi = Number(form.get("q") ?? 0), answer = String(form.get("answer") ?? "").trim().slice(0, 6000);
  if (answer.length < 15) return { error: "Say a bit more first. Even a rough answer gets useful feedback." };
  const { data: s } = await supabase.from("interview_sessions").select("id,title,company,questions").eq("id", sessionId).eq("user_id", user.id).maybeSingle();
  const q = (s?.questions as InterviewQuestion[] | undefined)?.[qi];
  if (!s || !q) return { error: "That session is gone." };
  try {
    const fb = await gradeAnswer({ question: q.q, answer, role: `${s.title}${s.company ? ` at ${s.company}` : ""}`, profile });
    await supabase.from("interview_answers").insert({ session_id: s.id, user_id: user.id, q_index: qi, answer, feedback: fb, score: fb.score });
  } catch { return { error: "Feedback didn't come back. Try again in a moment; your answer is still in the box." }; }
  revalidatePath(`/app/interview/${s.id}`);
  return null;
}

export async function toggleSaved(form: FormData) {
  const { supabase, user } = await me();
  const id = Number(form.get("id")), saved = form.get("saved") === "1";
  const { data } = await supabase.from("interview_answers").update({ saved }).eq("id", id).eq("user_id", user.id).select("session_id").maybeSingle();
  if (data) revalidatePath(`/app/interview/${data.session_id}`);
}

export async function startDrill(form: FormData) {
  const { supabase, user, profile } = await me();
  const jobId = String(form.get("job") ?? "") || null;
  const language = String(form.get("language") ?? "Python").slice(0, 20);
  const { data: past } = await supabase.from("oa_drills").select("drill").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
  const topic = pickTopic((past ?? []).map((d) => (d.drill as { topic?: string }).topic ?? ""));
  let company: string | null = null;
  if (jobId) { const { data } = await supabase.from("jobs").select("companies(name)").eq("id", jobId).maybeSingle(); company = (data as unknown as { companies: { name: string } | null } | null)?.companies?.name ?? null; }
  const credit = await spendCredit(supabase, user.id, "mock_interview");
  if (!credit.ok) redirect("/app/interview?locked=1");
  const level = profile.constraints.employmentTypes.includes("internship") ? "internship" : "new grad";
  let drill;
  try { drill = await generateDrill({ topic, level, language, company }); } catch { redirect("/app/interview?err=1"); }
  const { data: d } = await supabase.from("oa_drills").insert({ user_id: user.id, job_id: jobId, drill }).select("id").single();
  redirect(`/app/interview/oa/${d!.id}`);
}

export type ReviewState = { error?: string } | null;
export async function submitDrill(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  const { supabase, user } = await me();
  const id = String(form.get("id") ?? ""), code = String(form.get("code") ?? "").slice(0, 8000);
  if (code.trim().length < 20) return { error: "Write a solution first, even a brute force one." };
  const { data: row } = await supabase.from("oa_drills").select("id,drill").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!row) return { error: "That drill is gone." };
  try {
    const review = await reviewSolution(Drill.parse(row.drill), code);
    await supabase.from("oa_drills").update({ code, review, updated_at: new Date().toISOString() }).eq("id", id);
  } catch { return { error: "The review didn't come back. Try again." }; }
  revalidatePath(`/app/interview/oa/${id}`);
  return null;
}
