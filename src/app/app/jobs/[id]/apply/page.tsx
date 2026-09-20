import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { JobTags } from "@/lib/jobs/tags";
import { scoreJob, BAND_COLOR } from "@/lib/match/score";
import { CopyButton } from "@/components/copy-button";
import { markApplied } from "../../../actions";
import { Checklist, ReopenAts } from "./split";

export const dynamic = "force-dynamic";

/**
 * Apply companion: a narrow page meant to sit on the left half of the screen while the ATS form is on the right.
 * Everything the form will ask for is one click to copy; the requirement checklist and tailored resume are right here.
 */
export default async function ApplyCompanion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/jobs/${id}/apply`);
  const [{ data: profile }, { data: job }, { data: resume }, { data: app }] = await Promise.all([
    supabase.from("profiles").select("canonical,onboarding_done").eq("id", user.id).single(),
    supabase.from("jobs").select("id,title,location,url,apply_url,tags,companies(name)").eq("id", id).maybeSingle(),
    supabase.from("resumes").select("id,text_content,score,created_at").eq("user_id", user.id).eq("job_id", id).eq("kind", "tailored").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("applications").select("stage,cover_letter").eq("user_id", user.id).eq("job_id", id).maybeSingle(),
  ]);
  if (!profile?.onboarding_done) redirect("/onboarding");
  const me = CanonicalProfile.safeParse(profile.canonical); if (!me.success) redirect("/onboarding");
  if (!job) notFound();
  const p = me.data;
  const company = (job.companies as unknown as { name: string } | null)?.name ?? "";
  const tags = JobTags.safeParse(job.tags);
  const score = tags.success ? scoreJob(p, tags.data, { title: job.title, location: job.location }) : null;
  const applied = !!app && app.stage !== "saved" && app.stage !== "prepared";
  const edu = p.education[0];
  const fields: { label: string; value: string | null }[] = [
    { label: "Full name", value: p.name },
    { label: "Email", value: p.email },
    { label: "Phone", value: p.phone },
    { label: "Location", value: p.constraints.locations[0] ?? null },
    { label: "LinkedIn", value: p.links.linkedin },
    { label: "GitHub", value: p.links.github },
    { label: "Portfolio", value: p.links.portfolio },
    { label: "School", value: edu?.school ?? null },
    { label: "Degree", value: edu ? [edu.degree, edu.field].filter(Boolean).join(", ") : null },
    { label: "Graduation", value: edu?.gradYear ? String(edu.gradYear) : null },
    { label: "GPA", value: edu?.gpa != null ? String(edu.gpa) : null },
  ].filter((f) => f.value);
  const checklist = (score?.requirements ?? []).map((r) => ({ text: r.text, required: r.required, evidence: r.evidence }));

  return (
    <div className="min-h-screen bg-ground">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/app/jobs/${id}`} className="text-[13px] font-semibold text-muted hover:text-ink">← Job</Link>
          <span className="font-display text-sm font-extrabold tracking-tight">Rails · Apply</span>
          <Link href="/app/tracker" className="text-[13px] font-semibold text-muted hover:text-ink">Tracker</Link>
        </div>

        <header className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-display text-lg font-extrabold leading-tight tracking-tight">{job.title}</div>
              <div className="text-[13px] text-text">{company}{job.location ? ` · ${job.location}` : ""}</div>
            </div>
            {score && <div className="text-right"><div className="font-display text-3xl font-extrabold leading-none" style={{ color: BAND_COLOR[score.band] }}>{score.fit}</div><div className="text-[10px] font-bold uppercase tracking-wide text-muted">fit</div></div>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ReopenAts url={job.apply_url} />
            {applied ? <span className="rounded-full bg-green-chip px-3 py-2 text-[13px] font-bold text-green-chip-text">Applied ✓</span> : (
              <form action={markApplied} className="flex items-center gap-1.5 rounded-full border border-line bg-light px-2 py-1 text-[12px] font-semibold">
                <input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="url" value={job.apply_url} /><input type="hidden" name="title" value={job.title} /><input type="hidden" name="company" value={company} />
                <span className="px-1 text-text">Submitted it?</span>
                <button name="applied" value="1" className="rounded-full bg-ink px-3 py-1 text-white">Yes, applied</button>
              </form>
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted">The application opens in its own window on the right. Keep this one on the left. You click Submit over there; Rails never does.</p>
        </header>

        <section className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted">Form fields</h2>
          <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {fields.map((f) => (
              <li key={f.label} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-light px-2.5 py-1.5 text-[13px]">
                <div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-wide text-muted">{f.label}</div><div className="truncate text-ink" title={f.value ?? ""}>{f.value}</div></div>
                <CopyButton text={f.value ?? ""} small />
              </li>
            ))}
          </ul>
          {fields.length < 6 && <p className="mt-2 text-[11px] text-muted">Missing phone or links? <Link href="/onboarding/confirm" className="font-semibold text-ink underline">Edit your profile</Link>.</p>}
        </section>

        {checklist.length > 0 && <section className="rounded-2xl border border-line bg-surface p-4"><Checklist items={checklist} /></section>}

        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted">Tailored resume{resume?.score != null ? ` · ${resume.score}% keyword coverage` : ""}</h2>
            {resume ? <div className="flex gap-1.5"><CopyButton text={resume.text_content ?? ""} label="Copy all" small /><Link href={`/app/jobs/${id}/tailor/print`} target="_blank" className="rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold text-text">PDF ↗</Link></div>
              : <Link href={`/app/jobs/${id}/tailor`} className="rounded-full bg-ink px-3 py-1 text-[12px] font-bold text-white">Tailor for this job</Link>}
          </div>
          {resume?.text_content ? (
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-light p-3 font-sans text-[12px] leading-relaxed text-ink">{resume.text_content}</pre>
          ) : <p className="mt-2 text-[13px] text-muted">No tailored version yet. It takes one credit and about 20 seconds; upload the PDF it makes, or paste sections into the form.</p>}
        </section>

        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted">Cover letter</h2>
            {app?.cover_letter ? <CopyButton text={app.cover_letter} label="Copy letter" small /> : <Link href={`/app/jobs/${id}/letter`} className="rounded-full border border-line px-3 py-1 text-[12px] font-semibold text-text">Write one</Link>}
          </div>
          {app?.cover_letter ? <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-light p-3 font-sans text-[12px] leading-relaxed text-ink">{app.cover_letter}</pre> : <p className="mt-2 text-[13px] text-muted">Only if the form asks. Most don&apos;t.</p>}
        </section>
      </div>
    </div>
  );
}
