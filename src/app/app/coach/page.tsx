import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { planOf } from "@/lib/billing/entitlements";
import { COACH_SUGGESTIONS, coachPlan } from "@/lib/coach/context";
import { clearCoach, loadCoach } from "./actions";
import { Composer } from "./composer";

export const dynamic = "force-dynamic";

/** **bold** spans only; everything else is plain text. */
function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-bold text-ink">{part.slice(2, -2)}</strong> : part);
}
function CoachText({ text }: { text: string }) {
  const blocks = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((l, i) => {
        const m = l.match(/^(\d+)[.)]\s+(.*)$/);
        if (m) return <div key={i} className="flex gap-3"><span className="font-display text-[20px] font-extrabold leading-[1.2] text-blue">{m[1]}</span><p className="m-0">{inline(m[2]!)}</p></div>;
        return <p key={i} className="m-0">{inline(l.replace(/^[-•]\s+/, ""))}</p>;
      })}
    </div>
  );
}

export default async function CoachPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/coach");
  const [{ data: profile }, { data: credits }, { data: msgs }, plan, coach] = await Promise.all([
    supabase.from("profiles").select("full_name,onboarding_done").eq("id", user.id).single(),
    supabase.from("credits").select("balance").eq("user_id", user.id).maybeSingle(),
    supabase.from("coach_messages").select("id,role,content,sources,created_at").eq("user_id", user.id).order("created_at", { ascending: true }).limit(80),
    planOf(supabase, user.id),
    loadCoach(user.id),
  ]);
  if (!profile?.onboarding_done) redirect("/onboarding");
  const { facts, apps } = coach;
  const steps = coachPlan(facts);
  const doneN = steps.filter((s) => s.done).length;
  const thread = (msgs ?? []) as { id: number; role: "user" | "assistant"; content: string; sources: string[]; created_at: string }[];
  const cite = (s: string) => { const n = Number(s); const a = Number.isInteger(n) ? apps[n - 1] : undefined; return a ? `${a.company_name}, ${a.title}` : s; };

  return (
    <AppShell active="/app/coach" name={profile.full_name} credits={credits?.balance ?? 3} wide>
      <div className="grid grid-cols-1 gap-5 pb-10 lg:grid-cols-[300px_1fr]">
        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[15px] font-extrabold tracking-tight text-ink">Your line</h2>
              <span className="font-mono text-[12px] text-muted">{doneN} of {steps.length}</span>
            </div>
            <ol className="relative mt-4 flex flex-col gap-2 pl-6 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-[2px] before:bg-line">
              {steps.map((s) => (
                <li key={s.label} className="relative">
                  <span className={`absolute -left-6 top-3 h-4 w-4 rounded-full border-2 ${s.done ? "border-ink bg-ink" : "border-line-strong bg-surface"}`} aria-hidden="true" />
                  <Link href={s.href} className={`block rounded-xl border px-3 py-2 ${s.done ? "border-transparent bg-blue-chip" : "border-line bg-surface hover:border-ink"}`}>
                    <div className={`text-[13.5px] font-semibold ${s.done ? "text-ink" : "text-ink"}`}>{s.done ? "✓ " : ""}{s.label}</div>
                    <div className="text-[12px] text-muted">{s.detail}</div>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
            <h2 className="font-display text-[15px] font-extrabold tracking-tight text-ink">What Coach reads</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
              <div><dt className="text-muted">Applied</dt><dd className="font-display text-[20px] font-extrabold text-ink">{facts.funnel.applied}</dd></div>
              <div><dt className="text-muted">Interview rate</dt><dd className="font-display text-[20px] font-extrabold text-ink">{facts.funnel.interviewRate == null ? "—" : `${facts.funnel.interviewRate}%`}</dd></div>
              <div><dt className="text-muted">Quiet 7+ days</dt><dd className="font-display text-[20px] font-extrabold text-ink">{facts.quiet.length}</dd></div>
              <div><dt className="text-muted">Resume score</dt><dd className="font-display text-[20px] font-extrabold text-ink">{facts.resumeScore ?? "—"}</dd></div>
            </dl>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">Your profile and tracker only. Coach never sees your EEO answers or anything the extension keeps on your device.</p>
          </div>
        </aside>

        <section className="flex min-h-[70vh] flex-col rounded-2xl border border-line bg-surface shadow-[var(--shadow-sm)]">
          <header className="flex items-center justify-between border-b border-line px-6 py-4">
            <div>
              <h1 className="font-display text-[22px] font-extrabold leading-tight tracking-tight text-ink">Coach</h1>
              <p className="text-[13px] text-muted">Answers from your {apps.length} application{apps.length === 1 ? "" : "s"} and your profile.{plan === "free" ? " 3 questions a day on Free." : ""}</p>
            </div>
            {thread.length > 0 && <form action={clearCoach}><button className="text-[13px] font-semibold text-muted hover:text-ink">Clear</button></form>}
          </header>
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6" aria-live="polite">
            {thread.length === 0 && (
              <div className="m-auto max-w-md text-center">
                <div className="font-display text-[18px] font-extrabold text-ink">Ask about your search, not search in general.</div>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{apps.length ? `Coach has your ${apps.length} tracked applications, your stages and dates, and your profile.` : "Track a few applications first (Apply on any job adds it) and Coach gets specific."}</p>
              </div>
            )}
            {thread.map((m) => m.role === "user" ? (
              <div key={m.id} className="max-w-[560px] self-end rounded-2xl rounded-br-md bg-ink px-4 py-3 text-[15px] leading-relaxed text-white">{m.content}</div>
            ) : (
              <div key={m.id} className="flex max-w-[680px] flex-col gap-2 self-start">
                <div className="rounded-2xl rounded-bl-md border border-line bg-ground px-5 py-4 text-[15px] leading-relaxed text-text"><CoachText text={m.content} /></div>
                {m.sources?.length > 0 && <div className="text-[12px] text-muted">Sources: {m.sources.map(cite).join(" · ")}</div>}
              </div>
            ))}
          </div>
          <div className="border-t border-line px-6 py-4"><Composer suggestions={COACH_SUGGESTIONS} /></div>
        </section>
      </div>
    </AppShell>
  );
}
