import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { JobTags } from "@/lib/jobs/tags";
import { planOf } from "@/lib/billing/entitlements";
import { LetterForm } from "./form";

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/jobs/${id}/letter`);
  const [{ data: profile }, { data: job }, { data: app }, { data: credits }] = await Promise.all([
    supabase.from("profiles").select("full_name,onboarding_done,edu_verified").eq("id", user.id).single(),
    supabase.from("jobs").select("id,title,tags,companies(name)").eq("id", id).maybeSingle(),
    supabase.from("applications").select("cover_letter,notes,last_activity_at").eq("user_id", user.id).eq("job_id", id).maybeSingle(),
    supabase.from("credits").select("balance,refill_at").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!profile?.onboarding_done) redirect("/onboarding");
  if (!job) notFound();
  const plan = await planOf(supabase, user.id);
  const company = (job.companies as unknown as { name: string } | null)?.name ?? "";
  const sources: string[] = typeof app?.notes === "string" && app.notes.startsWith("Letter sources: ") ? app.notes.slice(16).split(" | ") : [];
  return (
    <AppShell active="/app" name={profile.full_name} credits={plan === "free" ? credits?.balance ?? 3 : null}>
      <div className="pb-10">
        <Link href={`/app/jobs/${id}`} className="text-sm font-semibold text-muted hover:text-ink">← {job.title}</Link>
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight">Cover letter for {company}</h1>
        <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-text">Three short paragraphs, plain voice, one honest line about a gap. Every fact comes from your profile and is listed underneath so you can check it.</p>
        <div className="mt-5"><LetterForm jobId={id} hasPrior={!!app?.cover_letter} tagged={JobTags.safeParse(job.tags).success} plan={plan} balance={credits?.balance ?? 3} refillAt={credits?.refill_at ?? null} student={!!profile.edu_verified} /></div>
        {app?.cover_letter && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
            <section className="rounded-2xl border border-line bg-surface p-6">
              <pre className="whitespace-pre-wrap font-sans text-[14.5px] leading-relaxed text-ink">{app.cover_letter}</pre>
            </section>
            <aside className="flex flex-col gap-4">
              <div className="rounded-2xl border border-line bg-surface p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted">From your profile</div>
                <ul className="mt-2 flex flex-col gap-1.5 text-[12px] leading-snug text-text">{sources.map((s: string, i: number) => <li key={i}>· {s}</li>)}</ul>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-4 text-[12px] leading-relaxed text-muted">Select all, copy, paste into the application. Edit anything that doesn&apos;t sound like you; it&apos;s your name on it.</div>
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}
