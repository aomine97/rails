import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recordUsage } from "@/lib/ai/usage";
import { aliasOf, classifyEmail, matchApplication, nextStage, parseInbound, type EmailKind } from "@/lib/inbound/classify";
import type { Stage } from "@/lib/tracker/stages";

export const dynamic = "force-dynamic";

const KINDS: EmailKind[] = ["confirmation", "rejection", "oa", "interview", "offer", "other"];

function authorized(req: Request): boolean {
  const secret = process.env.INBOUND_SECRET;
  if (!secret) return false;
  const given = new URL(req.url).searchParams.get("token") ?? (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Only when no rule fired: one word from Haiku. Cheap, and the answer is still checked against the list. */
async function modelKind(subject: string, text: string): Promise<EmailKind> {
  if (!process.env.ANTHROPIC_API_KEY) return "other";
  try {
    const client = new Anthropic();
    const model = "claude-haiku-4-5";
    const res = await client.messages.create({ model, max_tokens: 5, system: "Classify a job-application email. Answer one word: confirmation, rejection, oa, interview, offer, or other.", messages: [{ role: "user", content: `Subject: ${subject}\n\n${text.slice(0, 1500)}` }] });
    recordUsage("inbound", res.model ?? model, res.usage);
    const w = (res.content.find((c) => c.type === "text")?.text ?? "").trim().toLowerCase().replace(/[^a-z]/g, "") as EmailKind;
    return KINDS.includes(w) ? w : "other";
  } catch { return "other"; }
}

/** Provider webhook (Postmark / Resend / SendGrid inbound parse). URL: /api/inbound/email?token=INBOUND_SECRET */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const domain = process.env.INBOUND_DOMAIN;
  if (!domain) return NextResponse.json({ skipped: "INBOUND_DOMAIN not set" });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const mail = parseInbound(body);
  const alias = aliasOf(mail.to, domain);
  if (!alias) return NextResponse.json({ ignored: "no alias" });
  const db = supabaseAdmin();
  const { data: user } = await db.from("profiles").select("id").eq("forwarding_alias", alias).maybeSingle();
  if (!user) return NextResponse.json({ ignored: "unknown alias" });

  // Gmail's forwarding confirmation: keep enough text for the user to see the code and link.
  if (/forwarding-noreply@google\.com/i.test(mail.from) || /forwarding confirmation/i.test(mail.subject)) {
    await db.from("inbound_emails").insert({ user_id: user.id, from_addr: mail.from.slice(0, 200), subject: mail.subject.slice(0, 300), snippet: mail.text.slice(0, 700), kind: "other", status: "verification" });
    return NextResponse.json({ ok: true, verification: true });
  }

  const kind = classifyEmail(mail.subject, mail.text) ?? await modelKind(mail.subject, mail.text);
  const { data: apps } = await db.from("applications").select("id,company_name,title,stage,applied_at,last_activity_at").eq("user_id", user.id).order("last_activity_at", { ascending: false }).limit(300);
  const app = matchApplication((apps ?? []) as { id: string; company_name: string; title: string; stage: Stage; applied_at: string | null; last_activity_at: string }[], mail.from, mail.subject, mail.text);
  const now = new Date().toISOString();
  let moved: Stage | null = null;
  if (app) {
    moved = nextStage(app.stage, kind);
    if (moved) {
      const patch: Record<string, unknown> = { stage: moved, last_activity_at: now };
      if (!app.applied_at) patch.applied_at = now;
      await db.from("applications").update(patch).eq("id", app.id).eq("user_id", user.id);
      await db.from("application_events").insert({ application_id: app.id, kind: "stage_change", from_stage: app.stage, to_stage: moved, payload: { source: "email", subject: mail.subject.slice(0, 200) } });
    } else {
      await db.from("applications").update({ last_activity_at: now }).eq("id", app.id).eq("user_id", user.id);
      await db.from("application_events").insert({ application_id: app.id, kind: "email_in", payload: { subject: mail.subject.slice(0, 200), kind } });
    }
  }
  await db.from("inbound_emails").insert({
    user_id: user.id, from_addr: mail.from.slice(0, 200), subject: mail.subject.slice(0, 300), snippet: mail.text.slice(0, 200),
    kind, application_id: app?.id ?? null, moved_to: moved, status: moved ? "moved" : app ? "matched" : kind === "other" ? "ignored" : "unmatched",
  });
  return NextResponse.json({ ok: true, kind, matched: !!app, moved });
}
