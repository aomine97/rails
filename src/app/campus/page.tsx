import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Mark } from "@/components/app-shell";
import { campusData, staffCampus } from "@/lib/campus/load";
import { campusStats, parseTerm, recentTerms } from "@/lib/campus/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Career Center · Rails" };

const rateTone = (r: number | null, avg: number | null) => (r == null || avg == null ? "bg-g5" : r >= avg ? "bg-green" : r >= avg * 0.7 ? "bg-amber" : "bg-red");

export default async function CampusDashboard({ searchParams }: { searchParams: Promise<{ term?: string; c?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/campus");
  const campuses = await staffCampus(supabase, user.id, sp.c);
  const campus = campuses[0];
  if (!campus) redirect("/career-centers?notstaff=1");
  const now = new Date();
  const term = parseTerm(sp.term, now);
  const { students, apps } = await campusData(supabaseAdmin(), campus.id);
  const s = campusStats(students, apps, term, now);
  const h = s.headline;
  const pilotEnds = campus.pilot_until ? new Date(`${campus.pilot_until}T00:00:00Z`) : null;
  const cards: [string, string | number, string][] = [
    ["Students on Rails", h.students, `${h.active} applied this term`],
    ["Applications", h.applied, h.active ? `${(h.applied / h.active).toFixed(1)} per active student` : "—"],
    ["Interviews", h.interviews, h.interviewRate == null ? "—" : `${h.interviewRate}% of applications`],
    ["Offers", h.offers, "reported by students"],
  ];
  const maxFunnel = Math.max(1, ...s.funnel.map((f) => f.n));

  return (
    <main className="min-h-screen bg-ground">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3"><Mark /><div><div className="font-display text-[16px] font-extrabold text-ink">Rails <span className="font-semibold text-muted">for Career Centers</span></div><div className="text-[12px] text-muted">{campus.name} · {campus.school}</div></div></div>
          <form className="flex flex-wrap items-center gap-2" action="/campus">
            {campuses.length > 1 && <select name="c" defaultValue={campus.id} className="h-9 rounded-lg border border-line bg-surface px-2 text-[13px]">{campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
            <select name="term" defaultValue={term.key} className="h-9 rounded-lg border border-line bg-surface px-2 text-[13px]">{recentTerms(now).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
            <button className="h-9 rounded-lg border border-line px-3 text-[13px] font-semibold">Show</button>
            <a href={`/campus/export?c=${campus.id}&term=${term.key}`} className="inline-flex h-9 items-center rounded-lg bg-ink px-3 text-[13px] font-bold text-white">Export placement report</a>
          </form>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-4 py-6 md:px-8">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map(([l, n, note]) => (
            <div key={l} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-sm)]"><div className="text-[12px] font-semibold text-muted">{l}</div><div className="mt-1 font-display text-[30px] font-extrabold leading-none tracking-tight text-ink">{n}</div><div className="mt-1 text-[12px] text-muted">{note}</div></div>
          ))}
        </section>

        <section className="rounded-2xl border border-line bg-surface shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between border-b border-line px-5 py-4"><h2 className="font-display text-[16px] font-extrabold text-ink">Students who could use a counselor this week</h2><span className="rounded-full bg-amber-chip px-2.5 py-1 text-[12px] font-bold text-amber-chip-text">{s.flags.filter((f) => f.tone === "risk").length} flagged</span></div>
          {s.flags.length === 0 ? <p className="px-5 py-6 text-[14px] text-muted">Nobody flagged. Flags appear when a student goes two weeks without applying, sends 15+ applications with no replies, stalls after assessments, or has an interview coming.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[14px]">
                <thead><tr className="border-b border-line text-left text-[12px] font-semibold text-muted"><th className="px-5 py-2.5">Student</th><th className="px-3 py-2.5">Program</th><th className="px-3 py-2.5 text-right">Applied</th><th className="px-3 py-2.5 text-right">Interviews</th><th className="px-5 py-2.5">Why</th></tr></thead>
                <tbody>{s.flags.slice(0, 40).map((f) => (
                  <tr key={f.id} className="border-b border-line last:border-0"><td className="px-5 py-2.5 font-semibold text-ink">{f.name}</td><td className="px-3 py-2.5 text-text">{f.program}</td><td className="px-3 py-2.5 text-right font-mono">{f.applied}</td><td className="px-3 py-2.5 text-right font-mono">{f.interviews}</td><td className="px-5 py-2.5"><span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${f.tone === "risk" ? "bg-amber-chip text-amber-chip-text" : "bg-green-chip text-green-chip-text"}`}>{f.why}</span></td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p className="border-t border-line px-5 py-3 text-[12px] text-muted">You see names only for flagged students who allow it, and only these columns. Resumes, messages and anything the extension keeps on a student&apos;s device are never shown here.</p>
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
            <h2 className="font-display text-[16px] font-extrabold text-ink">Interview rate by program</h2>
            <p className="text-[12px] text-muted">Applications that led to at least one interview, {term.label}.</p>
            <ul className="mt-4 flex flex-col gap-3">{s.byProgram.map((p) => (
              <li key={p.name}><div className="flex justify-between text-[13px]"><span className="font-semibold text-ink">{p.name}</span><span className="font-mono text-ink">{p.rate == null ? "—" : `${p.rate}%`}</span></div>
                <div className="mt-1 h-2 rounded-full bg-g2"><div className={`h-2 rounded-full ${rateTone(p.rate, h.interviewRate)}`} style={{ width: `${Math.min(100, (p.rate ?? 0) * 3)}%` }} /></div>
                <div className="mt-0.5 text-[11px] text-muted">{p.students} students · {p.apps} applications</div></li>
            ))}</ul>
            <p className="mt-4 border-t border-line pt-3 text-[13px] text-text">Campus average <b className="text-ink">{h.interviewRate == null ? "—" : `${h.interviewRate}%`}</b>.{h.tailoredRate != null && h.untailoredRate != null && <> Tailored applications: <b className="text-ink">{h.tailoredRate}%</b>. Not tailored: <b className="text-ink">{h.untailoredRate}%</b>.</>}</p>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
            <h2 className="font-display text-[16px] font-extrabold text-ink">Where students get stuck</h2>
            <ul className="mt-4 flex flex-col gap-2.5">{s.funnel.map((f) => (
              <li key={f.stage} className="grid grid-cols-[130px_1fr_48px] items-center gap-3 text-[13px]"><span className="text-text">{f.stage}</span><div className="h-3 rounded bg-g2"><div className="h-3 rounded bg-ink" style={{ width: `${(100 * f.n) / maxFunnel}%` }} /></div><span className="text-right font-mono text-ink">{f.n}</span></li>
            ))}</ul>
            {s.drop && <p className="mt-4 border-t border-line pt-3 text-[13px] text-text">Biggest drop: <b className="text-ink">{s.drop.from.toLowerCase()} → {s.drop.to.toLowerCase()}</b>, {Math.round(s.drop.lost * 100)}% don&apos;t make it. A workshop on that step reaches the most students.</p>}
          </section>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
            <h2 className="font-display text-[16px] font-extrabold text-ink">Who&apos;s interviewing your students</h2>
            {s.employers.length === 0 ? <p className="mt-2 text-[14px] text-muted">No interviews reported yet this term.</p> : (
              <ul className="mt-3 divide-y divide-line">{s.employers.map((e) => (
                <li key={e.name} className="flex items-center justify-between gap-3 py-2.5 text-[14px]"><span className="min-w-0 truncate"><b className="text-ink">{e.name}</b> <span className="text-muted">· {e.roles.join(", ")}</span></span><span className="shrink-0 font-mono text-[12px] text-text">{e.offers} offers · {e.interviews} interviews</span></li>
              ))}</ul>
            )}
          </section>
          <section className="rounded-2xl bg-ink p-5 text-white">
            <h2 className="font-display text-[16px] font-extrabold">Your plan</h2>
            <dl className="mt-3 flex flex-col gap-2 text-[14px]">
              <div className="flex justify-between"><dt className="text-[#9FB0CB]">Seats</dt><dd>{h.students} of unlimited</dd></div>
              <div className="flex justify-between"><dt className="text-[#9FB0CB]">{pilotEnds && pilotEnds > now ? "Pilot" : "Term"}</dt><dd>{pilotEnds && pilotEnds > now ? `Free · ends ${pilotEnds.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : campus.paid_until ? `Paid through ${campus.paid_until}` : "Not active"}</dd></div>
              <div className="flex justify-between"><dt className="text-[#9FB0CB]">Students&apos; plan</dt><dd>Rails Pro, campus-paid</dd></div>
              <div className="flex justify-between"><dt className="text-[#9FB0CB]">Who joins</dt><dd className="font-mono text-[12px]">@{campus.edu_domain}</dd></div>
            </dl>
            <Link href="/career-centers" className="mt-4 inline-flex rounded-full bg-orange px-4 py-2 text-[13px] font-extrabold text-ink">Share the student link</Link>
          </section>
        </div>
      </div>
    </main>
  );
}
