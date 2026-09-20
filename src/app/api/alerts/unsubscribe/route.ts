import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** One-click unsubscribe from the email footer. Token, not session, so it works from any device. */
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  if (!/^[a-f0-9]{32}$/.test(t)) return new NextResponse("Bad link.", { status: 400 });
  const { data } = await supabaseAdmin().from("profiles").update({ alerts_enabled: false }).eq("unsubscribe_token", t).select("id").maybeSingle();
  const body = data ? "You are unsubscribed from Rails job alerts. Turn them back on any time under Settings." : "That link is no longer valid.";
  return new NextResponse(`<!doctype html><meta charset="utf-8"><body style="font-family:-apple-system,Segoe UI,sans-serif;padding:40px;max-width:520px;margin:auto;color:#0B1B3A"><h2>Rails</h2><p>${body}</p></body>`, { headers: { "content-type": "text/html" } });
}
