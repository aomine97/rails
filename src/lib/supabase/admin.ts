import { createClient } from "@supabase/supabase-js";

/** Service-role client. Server only (cron routes, webhooks). Never import from client code. */
export const supabaseAdmin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
