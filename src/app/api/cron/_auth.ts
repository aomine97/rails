import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

let dbToken: { value: string; at: number } | null = null;

/**
 * Two accepted bearers: CRON_SECRET from env (GitHub Actions, manual curl) and the token the database generated for
 * its own pg_cron schedules (Vault secret 'cron_secret', read through the service-role RPC cron_token()). Cached 10 min.
 */
export async function cronAuth(req: Request): Promise<NextResponse | null> {
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!given) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const env = process.env.CRON_SECRET;
  if (env && given === env) return null;
  try {
    if (!dbToken || Date.now() - dbToken.at > 600_000) {
      const { data } = await supabaseAdmin().rpc("cron_token");
      if (typeof data === "string" && data) dbToken = { value: data, at: Date.now() };
    }
    if (dbToken && given === dbToken.value) return null;
  } catch { /* fall through */ }
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
