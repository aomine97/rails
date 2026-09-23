import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { MODE_LABEL, type InterviewQuestion, type Mode } from "@/lib/interview/questions";
import type { Feedback } from "@/lib/interview/feedback";
import { AnswerBox } from "../answer-box";
import { toggleSaved } from "../actions";

export const dynamic = "force-dynamic";

const TAG = { keep: "bg-green-chip text-green-chip-text", cut: "bg-red-chip text-red-chip-text", tighten: "bg-amber-chip text-amber-chip-text" } as const;
const band = (n: number) => (n >= 8 ? "text-green" : n >= 6 ? "text-amber" : "text-red");

export default async function Session({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/interview/${id}`);
  const [{ data: profile }, { data: credits }, { data: s }, { data: answers }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase.from("credits").select("balance").eq("user_id", user.id).maybeSingle(),
    supabase.from("interview_sessions").select("id,title,company,mode,questions").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("interview_answers").select("id,q_index,answer,feedback,score,saved,created_at").eq("session_id", id).order("created_at", { ascending: false }),
  ]);
  if (!s) notFound();
  const qs = s.questions as InterviewQuestion[];
  const latest = new Map<number, { id: number; answer: string; feedback: Feedback; score: number; saved: boolean }>();
  for (const a of answers ?? []) if (!latest.has(a.q_index)) latest.set(a.q_index, a as never);
  const firstOpen = qs.findIndex((_, i) => !latest.has(i));
  const qi = Math.min(qs.length - 1, Math.max(0, sp.q != null ? Number(sp.q) : firstOpen === -1 ? 0 : firstOpen));
  const q = qs[qi]!;
  const cur = latest.get(qi);
  const fb = cur?.feedback;
  return (
    <AppShell active="/app/interview" name={profile?.full_name} credits={credits?.balance ?? 3} wide>
      <Link href="/app/interview" className="text-[13px] font-semibold text-muted hover:text-ink">← Interview</Link>
      <div className="mt-3 grid grid-cols-1 gap-5 pb-10 lg:grid-cols-[320px_1fr]">
        <aside className="order-2 flex flex-col gap-4 lg:order-1">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="text-[12px] font-semibold text-blue">Practising for · {MODE_LABEL[s.mode as Mode]}</div>
            <div className="mt-1 font-display text-[16px] font-extrabold leading-snug text-ink">{s.title}{s.company ? `, ${s.company}` : ""}</div>
          </div>
          <nav className="overflow-hidden rounded-2xl border border-line bg-surface" aria-label="Questions">
            <div className="border-b border-line px-4 py-3 text-[12px] font-semibold text-muted">Questions · {qs.length}</div>
            {qs.map((x, i) => { const a = latest.get(i); return (
              <Link key={i} href={`?q=${i}`} aria-current={i === qi ? "true" : undefined} className={`flex items-start justify-between gap-3 border-b border-line px-4 py-2.5 text-[13px] last:border-0 ${i === qi ? "bg-blue-chip font-semibold text-ink" : "text-text hover:bg-ground"}`}>
                <span className="line-clamp-2">{x.q}</span><span className={`shrink-0 font-mono text-[12px] font-bold ${a ? band(a.score) : "text-muted"}`}>{a ? a.score : "–"}</span>
              </Link>); })}
          </nav>
        </aside>
        <section className="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
          <div className="rounded-2xl bg-ink p-6 text-white md:p-7">
            <div className="flex items-center justify-between text-[12px] font-semibold"><span className="text-orange">Question {qi + 1} of {qs.length} · {q.kind}</span>{q.why && <span className="hidden text-[#9FB0CB] md:inline">Checking: {q.why}</span>}</div>
            <p className="mt-3 font-display text-[22px] font-extrabold leading-snug tracking-tight md:text-[26px]">&ldquo;{q.q}&rdquo;</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5"><AnswerBox key={`${qi}-${cur?.id ?? 0}`} session={s.id} q={qi} /></div>
          {cur && fb && (
            <>
              <div className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-baseline justify-between"><div className="text-[13px] font-semibold text-muted">Your last answer</div><div className="font-mono text-[12px] text-red">{fb.fillers.total ? `${fb.fillers.top.map(([w, n]) => `${n} "${w}"`).join(" · ")}` : "no filler words"}</div></div>
                <p className="mt-2 text-[15px] leading-relaxed text-text">{cur.answer}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-line bg-surface p-5">
                  <div className="flex items-center justify-between"><div className="text-[13px] font-semibold text-muted">Feedback</div><div className={`font-display text-[30px] font-extrabold leading-none ${band(fb.score)}`}>{fb.score}<span className="text-[15px] text-muted">/10</span></div></div>
                  <ul className="mt-3 flex flex-col gap-2.5 text-[14px] leading-relaxed">
                    {(["keep", "cut", "tighten"] as const).flatMap((k) => fb[k].map((t, i) => <li key={`${k}${i}`} className="flex gap-2.5"><span className={`h-fit rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${TAG[k]}`}>{k}</span><span>{t}</span></li>))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-line bg-blue-chip p-5">
                  <div className="text-[13px] font-semibold text-blue-chip-text">A stronger version · your words only</div>
                  {fb.stronger ? <p className="mt-2 text-[15px] leading-relaxed text-ink">&ldquo;{fb.stronger}&rdquo;</p> : <p className="mt-2 text-[14px] text-blue-chip-text">{fb.strongerDropped ? "The rewrite added things you didn't say, so it was dropped. Use the notes and try again." : "Not enough in the answer to tighten without inventing. Add a specific example and retry."}</p>}
                  <div className="mt-3 border-t border-blue/20 pt-2 font-mono text-[11px] text-blue-chip-text">Built only from what you said. Nothing added.</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <form action={toggleSaved}><input type="hidden" name="id" value={cur.id} /><input type="hidden" name="saved" value={cur.saved ? "0" : "1"} /><button className="h-11 rounded-xl border border-line px-4 text-[14px] font-bold text-ink hover:border-ink">{cur.saved ? "Saved to answer bank ✓" : "Save to answer bank"}</button></form>
                {qi < qs.length - 1 ? <Link href={`?q=${qi + 1}`} className="inline-flex h-11 items-center rounded-xl bg-ink px-5 text-[14px] font-bold text-white">Next question →</Link> : <Link href="/app/interview" className="inline-flex h-11 items-center rounded-xl bg-ink px-5 text-[14px] font-bold text-white">Finish</Link>}
              </div>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
