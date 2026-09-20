"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { importPosting } from "@/lib/jobs/import";

export type PasteState = { error?: string };

/** Paste a URL (or URL + description text). Fetch, tag now, add to the feed as source=paste, open the detail page. */
export async function pastePosting(_prev: PasteState, form: FormData): Promise<PasteState> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/paste");
  const r = await importPosting(supabaseAdmin(), user.id, String(form.get("url") ?? "").trim(), String(form.get("text") ?? "").trim(), String(form.get("title") ?? "").trim());
  if ("error" in r) return { error: r.error };
  redirect(`/app/jobs/${r.jobId}`);
}
