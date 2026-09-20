import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { extUser, CORS, preflight } from "@/lib/ext/auth";
import { answerQuestions, Question } from "@/lib/ext/answers";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
const Body = z.object({ url: z.string().optional(), company: z.string().optional(), title: z.string().optional(), questions: z.array(Question).max(60) });

/** POST {questions:[{id,label,kind,options?,required?}]} -> answers from the profile for questions the rule filler could not place. Free on every plan (Haiku). EEO/pronouns never reach here: the extension filters them first, and NEVER drops any that slip through. */
export async function POST(req: Request) {
  const u = await extUser(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad_request" }, { status: 400, headers: CORS });
  const { data: p } = await supabaseAdmin().from("profiles").select("canonical").eq("id", u.id).single();
  const parsed = CanonicalProfile.safeParse(p?.canonical);
  if (!parsed.success) return NextResponse.json({ error: "onboarding_incomplete" }, { status: 409, headers: CORS });
  try {
    const answers = await answerQuestions(parsed.data, body.data.questions, body.data);
    return NextResponse.json({ answers }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: "answers_failed", detail: String((e as Error).message).slice(0, 200) }, { status: 502, headers: CORS });
  }
}
