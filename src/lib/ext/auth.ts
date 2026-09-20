import { supabaseAdmin } from "@/lib/supabase/admin";

/** Resolve the extension bearer to a user id. Tokens are 48 hex chars minted by /ext/connect. */
export async function extUser(req: Request): Promise<{ id: string } | null> {
  const t = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!/^[a-f0-9]{48}$/.test(t)) return null;
  const { data } = await supabaseAdmin().from("profiles").select("id").eq("ext_token", t).maybeSingle();
  return data ? { id: data.id } : null;
}

export const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST, OPTIONS" };
export const preflight = () => new Response(null, { status: 204, headers: CORS });
