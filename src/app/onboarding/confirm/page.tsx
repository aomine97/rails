import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Wordmark } from "@/components/ui";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { ConfirmForm } from "./confirm-form";

export default async function ConfirmPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding/confirm");
  const { data: profile } = await supabase.from("profiles").select("canonical,email").eq("id", user.id).single();
  const parsed = CanonicalProfile.safeParse(profile?.canonical);
  if (!parsed.success) redirect("/onboarding");
  return (
    <main className="flex flex-1 flex-col bg-marketing">
      <header className="flex items-center justify-between px-6 py-4"><Wordmark /><span className="text-sm text-muted">Step 2 of 2 · {profile?.email}</span></header>
      <section className="mx-auto w-full max-w-3xl px-6 py-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Confirm your facts.</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-text">Everything we read off your resume. Fix anything wrong, add what&apos;s missing. Anything you add here counts as yours, and it&apos;s what every tailored resume can draw on. The numbers are what get you read.</p>
        <div className="mt-6"><ConfirmForm initial={parsed.data} /></div>
      </section>
    </main>
  );
}
