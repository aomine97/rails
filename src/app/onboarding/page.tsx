import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Wordmark } from "@/components/ui";
import { UploadForm } from "./upload-form";

export default async function OnboardingPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");
  const { data: profile } = await supabase.from("profiles").select("canonical,onboarding_done").eq("id", user.id).single();
  if (profile?.onboarding_done) redirect("/app");
  if (profile?.canonical) redirect("/onboarding/confirm");
  return (
    <main className="flex flex-1 flex-col bg-marketing">
      <header className="flex items-center justify-between px-6 py-4"><Wordmark /><span className="text-sm text-muted">Step 1 of 2</span></header>
      <section className="mx-auto w-full max-w-xl px-6 py-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Upload your resume.</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-text">We read it into a profile you confirm on the next screen. Every fit score, tailored resume and autofill comes from that profile, so the fuller it is, the better you come out.</p>
        <div className="mt-8"><UploadForm /></div>
        <p className="mt-6 text-xs leading-relaxed text-muted">PDF or Word, under 5 MB. Your file is stored privately; only you and Rails can read it.</p>
      </section>
    </main>
  );
}
