import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import type { Drill, Review } from "@/lib/interview/oa";
import { DrillEditor } from "./drill";

export const dynamic = "force-dynamic";
const VERDICT: Record<string, string> = { correct: "bg-green-chip text-green-chip-text", mostly: "bg-amber-chip text-amber-chip-text", wrong: "bg-red-chip text-red-chip-text", incomplete: "bg-red-chip text-red-chip-text" };

export default async function OaDrill({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/interview/oa/${id}`);
  const [{ data: profile }, { data: credits }, { data: row }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase.from("credits").select("balance").eq("user_id", user.id).maybeSingle(),
    supabase.from("oa_drills").select("id,drill,code,review").eq("id", id).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!row) notFound();
  const d = row.drill as Drill; const r = row.review as Review | null;
  return (
    <AppShell active="/app/interview" name={profile?.full_name} credits={credits?.balance ?? 3} wide>
      <Link href="/app/interview" className="text-[13px] font-semibold text-muted hover:text-ink">← Interview</Link>
      <div className="mt-3 grid grid-cols-1 gap-5 pb-10 lg:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
          <div className="text-[12px] font-semibold text-blue">OA drill{d.topic ? ` · ${d.topic}` : ""} · {d.minutes} minutes</div>
          <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-ink">{d.title}</h1>
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-text">{d.prompt}</p>
          <div className="flex flex-col gap-2">{d.examples.map((e, i) => (
            <div key={i} className="rounded-xl bg-ground p-3 font-mono text-[13px]"><div><span className="text-muted">Input:</span> {e.input}</div><div><span className="text-muted">Output:</span> {e.output}</div>{e.note && <div className="mt-1 font-sans text-[12px] text-muted">{e.note}</div>}</div>
          ))}</div>
          {d.constraints.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-muted">{d.constraints.map((c, i) => <li key={i}>{c}</li>)}</ul>}
          {r && <details className="rounded-xl border border-line p-3 text-[14px]"><summary className="cursor-pointer font-semibold text-ink">Intended approach</summary><p className="mt-2 leading-relaxed text-text">{d.approach}</p>{d.complexity && <p className="mt-1 font-mono text-[12px] text-muted">{d.complexity}</p>}</details>}
        </section>
        <section className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-surface p-5"><DrillEditor id={row.id} minutes={d.minutes} language={d.language} initial={row.code ?? ""} hints={d.hints} /></div>
          {r && (
            <div className="rounded-2xl border border-line bg-surface p-5 text-[14px]">
              <div className="flex items-center gap-2"><span className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold uppercase ${VERDICT[r.verdict] ?? ""}`}>{r.verdict}</span>{r.complexity && <span className="font-mono text-[12px] text-muted">{r.complexity}</span>}</div>
              {r.issues.length > 0 && <><div className="mt-3 text-[12px] font-semibold text-muted">Issues</div><ul className="mt-1 list-disc space-y-1 pl-5 text-text">{r.issues.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
              {r.edgeCases.length > 0 && <><div className="mt-3 text-[12px] font-semibold text-muted">Inputs it would miss</div><ul className="mt-1 list-disc space-y-1 pl-5 font-mono text-[13px] text-text">{r.edgeCases.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
              {r.next && <p className="mt-3 text-text"><b className="text-ink">Next:</b> {r.next}</p>}
              <p className="mt-3 text-[12px] text-muted">Reviewed by reading the code, not running it. Test it on the examples yourself too.</p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
