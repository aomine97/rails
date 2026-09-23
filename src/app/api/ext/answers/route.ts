import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { extUser, CORS, preflight } from "@/lib/ext/auth";
import { answerQuestions, Question, type Answer } from "@/lib/ext/answers";
import { isEssay, readPrefs } from "@/lib/ext/prefs";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
const Body = z.object({ url: z.string().optional(), company: z.string().optional(), title: z.string().optional(), questions: z.array(Question).max(60) });

/** POST {questions:[{id,label,kind,options?,required?}]} -> answers from the profile for questions the rule filler could not place. Free on every plan (Haiku). EEO/pronouns never reach here: the extension filters them first, and NEVER drops any that slip through. */
export async function POST(req: Request) {
  const u = await extUser(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad_request" }, { status: 400, headers: CORS });
  const db = supabaseAdmin();
  const [{ data: p }, { data: base }] = await Promise.all([
    db.from("profiles").select("canonical,autofill_prefs").eq("id", u.id).single(),
    db.from("resumes").select("text_content").eq("user_id", u.id).eq("kind", "base").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const parsed = CanonicalProfile.safeParse(p?.canonical);
  if (!parsed.success) return NextResponse.json({ error: "onboarding_incomplete" }, { status: 409, headers: CORS });
  // "Fill, skip the essays": long answers are left for the user, never sent to the model.
  const skipEssays = readPrefs(p?.autofill_prefs).essays === "skip";
  const skipped: Answer[] = skipEssays ? body.data.questions.filter(isEssay).map((q) => ({ id: q.id, value: null, why: "You write long answers yourself (Autofill settings)." })) : [];
  const ask = skipEssays ? body.data.questions.filter((q) => !isEssay(q)) : body.data.questions;
  try {
    const answers = ask.length ? await answerQuestions(parsed.data, ask, { ...body.data, resumeText: base?.text_content ?? null }) : [];
    return NextResponse.json({ answers: [...answers, ...skipped] }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: "answers_failed", detail: String((e as Error).message).slice(0, 200) }, { status: 502, headers: CORS });
  }
}
