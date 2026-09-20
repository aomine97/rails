import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { CanonicalProfile } from "@/lib/schemas/profile";
import type { Tailored } from "@/lib/tailor/generate";

/** Print-ready one-page resume. Browser "Save as PDF" is the export. */
export default async function PrintResume({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: r }] = await Promise.all([
    supabase.from("profiles").select("canonical").eq("id", user.id).single(),
    supabase.from("resumes").select("diff").eq("user_id", user.id).eq("job_id", id).eq("kind", "tailored").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const me = CanonicalProfile.safeParse(profile?.canonical); const t = r?.diff as Tailored | null;
  if (!me.success || !t) notFound();
  const p = me.data;
  return (
    <main className="mx-auto max-w-[8.5in] bg-white p-[0.7in] font-sans text-[11pt] leading-[1.35] text-black print:p-0">
      <style>{`@page { size: letter; margin: 0.6in } @media print { body { background: white } .noprint { display: none } }`}</style>
      <div className="noprint mb-4 flex items-center justify-between rounded-lg bg-[#EDF1F8] px-3 py-2 text-[10pt]"><span>Press Cmd+P / Ctrl+P and choose "Save as PDF".</span><span className="text-[#5B6B85]">Rails</span></div>
      <header className="border-b-2 border-black pb-2">
        <div className="text-[20pt] font-extrabold tracking-tight">{p.name}</div>
        <div className="text-[10pt]">{[p.email, p.phone, p.links.linkedin, p.links.github, p.links.portfolio].filter(Boolean).join(" · ")}</div>
        {t.headline && <div className="mt-1 text-[11pt] font-semibold">{t.headline}</div>}
      </header>
      {t.summary && <p className="mt-2">{t.summary}</p>}
      <section className="mt-3"><h2 className="text-[10pt] font-extrabold uppercase tracking-wider">Skills</h2><p>{t.skillsOrder.join(" · ")}</p></section>
      <section className="mt-3"><h2 className="text-[10pt] font-extrabold uppercase tracking-wider">Experience</h2>
        {t.experience.map((e) => { const src = p.experience.find((x) => x.id === e.id); return (
          <div key={e.id} className="mt-2">
            <div className="flex justify-between"><span className="font-bold">{e.title}, {e.org}</span><span className="text-[10pt]">{src?.start ?? ""}{src ? ` – ${src.end ?? "Present"}` : ""}</span></div>
            <ul className="ml-4 list-disc">{e.after.map((b, i) => <li key={i}>{b.text}</li>)}</ul>
          </div>); })}
      </section>
      <section className="mt-3"><h2 className="text-[10pt] font-extrabold uppercase tracking-wider">Education</h2>
        {p.education.map((ed, i) => <div key={i} className="flex justify-between"><span><span className="font-bold">{ed.degree} {ed.field}</span>, {ed.school}</span><span className="text-[10pt]">{ed.gradYear ?? ""}</span></div>)}
      </section>
      {p.certifications.length > 0 && <section className="mt-3"><h2 className="text-[10pt] font-extrabold uppercase tracking-wider">Certifications</h2><p>{p.certifications.map((c) => c.name).join(" · ")}</p></section>}
    </main>
  );
}
