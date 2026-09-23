import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { MarketingFooter, MarketingHeader } from "@/components/marketing";
import { PRICES } from "@/lib/billing/plans";

export const revalidate = 3600;

/** Live numbers only. If the database can't be reached the strip hides rather than showing a made-up figure. */
async function liveStats(): Promise<{ jobs: number; companies: number } | null> {
  try {
    const db = supabaseAdmin();
    const [{ count: jobs }, { count: companies }] = await Promise.all([
      db.from("jobs").select("id", { count: "estimated", head: true }).is("closed_at", null).not("tagged_at", "is", null).neq("tags->>field", "other"),
      db.from("companies").select("id", { count: "exact", head: true }).eq("active", true),
    ]);
    return jobs && companies ? { jobs, companies } : null;
  } catch { return null; }
}

const FIELDS = ["Software", "Data & analytics", "Cloud & DevOps", "IT support", "Cybersecurity", "Product", "Electrical", "Mechanical", "Civil", "Chemical", "Aerospace", "Biomedical", "Biotech & lab", "Science & research", "Math & statistics", "Nursing", "Allied health"];

const FEATURES: { title: string; body: string; icon: string }[] = [
  { title: "A fit score with its reasons", body: "Every job gets a number from 0 to 100 and the lines behind it: which requirements you meet, which you miss, and the resume line that earned each one.", icon: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 4v5l3 2" },
  { title: "A resume tailored per posting", body: "Your bullets rewritten toward the job. Every line shows the original it came from. Nothing invented, ever.", icon: "M7 3h7l5 5v13H7zM14 3v5h5M9 13h6M9 17h6" },
  { title: "Forms filled in seconds", body: "The Chrome extension fills Greenhouse, Lever, Ashby, Workday, iCIMS, SmartRecruiters and more. It answers custom questions from your profile and shows you every field.", icon: "M4 6h16M4 12h10M4 18h7" },
  { title: "Autopilot, with you on Submit", body: "Overnight, Rails picks the best new matches, tailors a resume for each and lines them up. You review in the morning and click Submit yourself.", icon: "M13 2L3 14h7l-1 8 10-12h-7l1-8z" },
  { title: "A tracker that updates itself", body: "Forward recruiter emails to your Rails address. Confirmations, assessments, interviews and rejections move the right card. Follow-ups come to you.", icon: "M4 5h16v14H4zM8 10h8M8 14h5" },
  { title: "Coach that reads your numbers", body: "Ask why you're not hearing back and get an answer from your own applications: which went quiet, what they had in common, what to do next.", icon: "M4 5h16v10H8l-4 4z" },
];

function Ring({ value }: { value: number }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" role="img" aria-label={`Fit ${value} of 100`}>
      <circle cx="46" cy="46" r={r} fill="none" stroke="#E4EAF4" strokeWidth="9" />
      <circle cx="46" cy="46" r={r} fill="none" stroke="#16A34A" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(c * value) / 100} ${c}`} transform="rotate(-90 46 46)" />
      <text x="46" y="52" textAnchor="middle" className="fill-ink font-display" fontSize="24" fontWeight="800">{value}</text>
    </svg>
  );
}

function ExampleCard() {
  const meters: [string, number][] = [["Skills", 92], ["Experience", 81], ["Field", 100]];
  return (
    <div className="relative w-full max-w-[460px] rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-lg)]">
      <span className="absolute -top-3 left-6 rounded-full bg-ink px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Example</span>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[12px] font-semibold text-muted">Posted 3 hours ago · Internship</div>
          <div className="mt-1 font-display text-[19px] font-extrabold leading-snug text-ink">Software Engineer Intern, Summer 2027</div>
          <div className="text-[14px] text-text">A company you&apos;d apply to · Hybrid</div>
        </div>
        <Ring value={91} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {meters.map(([l, v]) => (
          <div key={l}>
            <div className="flex justify-between text-[12px]"><span className="text-muted">{l}</span><span className="font-mono font-semibold text-ink">{v}</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-g2"><div className="h-1.5 rounded-full bg-green" style={{ width: `${v}%` }} /></div>
          </div>
        ))}
      </div>
      <ul className="mt-5 flex flex-col gap-2 text-[14px]">
        <li className="flex gap-2"><span className="font-bold text-green">✓</span><span>Python and Java <span className="text-muted">· from “Built a Flask API for…”</span></span></li>
        <li className="flex gap-2"><span className="font-bold text-green">✓</span><span>Cloud coursework <span className="text-muted">· AWS Cloud Practitioner</span></span></li>
        <li className="flex gap-2"><span className="font-bold text-red">✗</span><span>Spring Boot <span className="text-muted">· not on your resume. Have it? Add it in one line.</span></span></li>
      </ul>
      <div className="mt-5 flex gap-2">
        <span className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-orange text-[14px] font-extrabold text-ink">Tailor and apply</span>
        <span className="inline-flex h-10 items-center justify-center rounded-xl border border-line px-4 text-[14px] font-bold text-ink">Save</span>
      </div>
    </div>
  );
}

export default async function Home() {
  const [stats, signedIn] = await Promise.all([
    liveStats(),
    supabaseServer().then((s) => s.auth.getUser()).then((r) => !!r.data.user).catch(() => false),
  ]);
  return (
    <main className="flex flex-1 flex-col bg-marketing">
      <MarketingHeader signedIn={signedIn} />

      <section className="mx-auto grid w-full max-w-[1180px] grid-cols-1 items-center gap-12 px-4 pb-16 pt-12 md:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-blue">For STEM and nursing students and early-career people</p>
          <h1 className="mt-3 font-display text-[44px] font-extrabold leading-[1.04] tracking-tight text-ink md:text-[58px]">Apply to ten jobs a day, properly.</h1>
          <p className="mt-5 max-w-[560px] text-[18px] leading-relaxed text-text">Every open role in your field, scored against your resume with the reasons shown. A resume tailored to each posting. Every form filled in seconds. You click Submit.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={signedIn ? "/app" : "/signup"} className="inline-flex h-12 items-center rounded-xl bg-orange px-6 text-[16px] font-extrabold text-ink shadow-[var(--shadow-cta)] hover:brightness-105">{signedIn ? "Open your jobs" : "Join free"}</Link>
            <Link href="/pricing" className="inline-flex h-12 items-center rounded-xl border border-line-strong bg-surface px-5 text-[15px] font-bold text-ink hover:border-ink">See pricing</Link>
          </div>
          <p className="mt-4 text-[13px] text-muted">Free forever for the feed, scores, autofill and tracker. No card to start. Students: Pro is ${PRICES.proMonthlyStudent}/mo.</p>
        </div>
        <div className="flex justify-center lg:justify-end"><ExampleCard /></div>
      </section>

      {stats && (
        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-6 px-4 py-8 text-center sm:grid-cols-3 md:px-8">
            <div><div className="font-display text-[32px] font-extrabold tracking-tight text-ink">{stats.jobs.toLocaleString()}</div><div className="text-[13px] text-muted">open STEM and nursing jobs right now</div></div>
            <div><div className="font-display text-[32px] font-extrabold tracking-tight text-ink">{stats.companies.toLocaleString()}</div><div className="text-[13px] text-muted">employers, read from their own career sites</div></div>
            <div><div className="font-display text-[32px] font-extrabold tracking-tight text-ink">Hourly</div><div className="text-[13px] text-muted">checks, so closed jobs leave the feed</div></div>
          </div>
        </section>
      )}

      <section id="how" className="mx-auto w-full max-w-[1180px] px-4 py-20 md:px-8">
        <h2 className="max-w-[640px] font-display text-[34px] font-extrabold leading-tight tracking-tight text-ink">Everything between finding a job and clicking Submit.</h2>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-chip text-blue"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={f.icon} /></svg></div>
              <h3 className="mt-4 font-display text-[18px] font-extrabold tracking-tight text-ink">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-text">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="fields" className="bg-ink text-white">
        <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-10 px-4 py-20 md:px-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="font-display text-[34px] font-extrabold leading-tight tracking-tight">Every STEM degree. Plus nursing.</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[#C9D3E4]">Most job apps are built for software engineers. Rails reads every posting and keeps the ones that fit a STEM or nursing degree, from help desk to civil engineering to RN residencies. Nothing else reaches your feed.</p>
          </div>
          <ul className="flex flex-wrap content-start gap-2">
            {FIELDS.map((f) => <li key={f} className="rounded-full border border-navy-line bg-navy-2 px-4 py-2 text-[14px] font-semibold">{f}</li>)}
          </ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1180px] px-4 py-20 md:px-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            ["You click Submit. Always.", "Rails fills and prepares. It never submits an application or messages anyone for you. Employers see you, not a bot."],
            ["Every line traces back to you.", "Tailored resumes only use what's on your resume or what you typed in yourself. Each rewritten line shows its source."],
            ["Sensitive answers stay on your device.", "Demographic and EEO answers, and the passwords the extension makes for job sites, live in your browser. Our servers never receive them."],
          ].map(([t, b]) => (
            <div key={t} className="rounded-2xl border border-line bg-surface p-6">
              <h3 className="font-display text-[18px] font-extrabold tracking-tight text-ink">{t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-text">{b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1180px] px-4 pb-20 md:px-8">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-surface p-8 shadow-[var(--shadow-md)] md:flex-row md:items-center md:p-10">
          <div>
            <h2 className="font-display text-[28px] font-extrabold tracking-tight text-ink">Free to start. ${PRICES.proMonthlyStudent}/mo for students on Pro.</h2>
            <p className="mt-2 max-w-[620px] text-[15px] text-text">Or ${PRICES.semesterStudent} once for a whole recruiting season with a school email (${PRICES.semester} otherwise). No weekly plans. Refund within 7 days, no questions.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/pricing" className="inline-flex h-12 items-center rounded-xl border border-line-strong px-5 text-[15px] font-bold text-ink hover:border-ink">Compare plans</Link>
            <Link href={signedIn ? "/app" : "/signup"} className="inline-flex h-12 items-center rounded-xl bg-orange px-6 text-[15px] font-extrabold text-ink shadow-[var(--shadow-cta)]">{signedIn ? "Open Rails" : "Join free"}</Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
