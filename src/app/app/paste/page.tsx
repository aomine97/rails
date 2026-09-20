import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { PasteForm } from "./form";

export default async function PastePage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/paste");
  const { data: profile } = await supabase.from("profiles").select("full_name,onboarding_done").eq("id", user.id).single();
  if (!profile?.onboarding_done) redirect("/onboarding");
  return (
    <AppShell active="/app" name={profile.full_name}>
      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Add a job from anywhere</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-text">Paste a posting link from LinkedIn, Handshake, a company site, anywhere. Rails reads it, scores it against your profile, and it shows up under External with everything the feed has.</p>
        <div className="mt-6"><PasteForm /></div>
      </div>
    </AppShell>
  );
}
