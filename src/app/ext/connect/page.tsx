import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Opened by the extension's "Connect" button. Mints a fresh token for the signed-in user and renders it in a meta tag;
 * the extension's content script on this page reads it into chrome.storage. Refreshing rotates the token.
 */
export default async function ExtConnect() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/ext/connect");
  const token = randomBytes(24).toString("hex");
  await supabaseAdmin().from("profiles").update({ ext_token: token, ext_connected_at: new Date().toISOString() }).eq("id", user.id);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-marketing px-6">
      <meta name="rails-ext-token" content={token} />
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center">
        <div className="flex justify-center"><Wordmark /></div>
        <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">Extension connected</h1>
        <p className="mt-2 text-[14px] text-text">This tab handed a key to the Rails extension. You can close it. If the side panel still says &ldquo;Not connected&rdquo;, reopen it from the toolbar icon.</p>
        <p className="mt-4 text-[12px] text-muted">The key only lets the extension read your profile fields and record which form fields it filled. Open this page again any time to issue a new one; the old one stops working.</p>
      </div>
    </main>
  );
}
