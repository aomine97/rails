import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Wordmark } from "@/components/ui";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { ConfirmForm } from "./confirm-form";

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding/confirm");
  const { data: profile } = await supabase.from("profiles").select("canonical,email").eq("id", user.id).single();
  const parsed = CanonicalProfile.safeParse(profile?.canonical);
  if (!parsed.success) redirect("/onboarding");
  return (
    <main className="flex flex-1 flex-col bg-ground">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/90 px-6 py-3 backdrop-blur"><Wordmark /><span className="text-[13px] text-muted">{profile?.email}</span></header>
      <section className="mx-auto w-full max-w-[680px] px-4 py-8 md:px-6">
        <ol className="flex items-center gap-2 text-[12px] font-semibold text-muted" aria-label="Progress">
          <li className="flex items-center gap-1.5 text-ink"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] text-white">✓</span> Resume</li>
          <li className="h-px w-8 bg-line-strong" aria-hidden="true" />
          <li className="flex items-center gap-1.5 text-ink"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange text-[10px] font-extrabold text-ink">2</span> Confirm</li>
          <li className="h-px w-8 bg-line" aria-hidden="true" />
          <li className="flex items-center gap-1.5"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-line-strong text-[10px]">3</span> Your feed</li>
        </ol>
        <h1 className="mt-5 font-display text-[28px] font-extrabold leading-tight tracking-tight text-ink">Confirm your facts.</h1>
        <p className="prose-measure mt-2 text-[15px] leading-relaxed text-text">Everything Rails read off your resume. Fix what&apos;s wrong, add what&apos;s missing. Anything here counts as yours and is what every tailored resume can draw on.</p>
        <div className="mt-6"><ConfirmForm initial={parsed.data} next={next} /></div>
      </section>
    </main>
  );
}
