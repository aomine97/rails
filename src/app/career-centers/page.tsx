import type { Metadata } from "next";
import { MarketingFooter, MarketingHeader } from "@/components/marketing";
import { requestPilot } from "./actions";

export const metadata: Metadata = { title: "Career Centers · Rails", description: "Every student gets Rails Pro. Counselors get program-level numbers and the students who need a hand." };

export default async function CareerCenters({ searchParams }: { searchParams: Promise<{ sent?: string; err?: string; notstaff?: string }> }) {
  const sp = await searchParams;
  const input = "h-11 rounded-xl border border-line-strong bg-surface px-3 text-[15px] text-ink outline-none focus:border-blue focus:ring-2 focus:ring-blue/20";
  return (
    <main className="flex flex-1 flex-col bg-marketing">
      <MarketingHeader />
      <section className="mx-auto w-full max-w-[1180px] px-4 pb-12 pt-14 md:px-8">
        {sp.notstaff && <p className="mb-6 rounded-xl bg-amber-chip px-4 py-2.5 text-[14px] text-amber-chip-text">Your account isn&apos;t linked to a career center yet. If your office is in the pilot, ask us to add you; otherwise request a pilot below.</p>}
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-blue">For career centers</p>
        <h1 className="mt-3 max-w-[820px] font-display text-[42px] font-extrabold leading-[1.05] tracking-tight text-ink md:text-[52px]">Every student gets Pro. Your counselors get the numbers.</h1>
        <p className="mt-5 max-w-[680px] text-[18px] leading-relaxed text-text">Students with your school email get Rails Pro, paid by the campus. Your team sees how the whole campus is doing, program by program, and which students need a conversation this week.</p>
      </section>

      <section className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-4 px-4 pb-16 md:grid-cols-3 md:px-8">
        {[
          ["What students get", ["Every open STEM and nursing job, scored against their resume", "A resume tailored per posting, cover letters, autofill", "Autopilot, Coach, mock interviews and OA drills", "A tracker that updates from recruiter emails"]],
          ["What counselors see", ["Interview rate by program, this term and past terms", "Where students stall: replies, assessments, interviews", "Which employers are interviewing your students", "Students who could use help, and why", "A placement report you can export"]],
          ["What counselors never see", ["Resume text, cover letters or Coach conversations", "Emails students forward", "Demographic answers (they never leave the student's browser)", "Names of students who opt out; they still count in totals"]],
        ].map(([t, items]) => (
          <div key={t as string} className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
            <h2 className="font-display text-[18px] font-extrabold tracking-tight text-ink">{t as string}</h2>
            <ul className="mt-3 flex flex-col gap-2 text-[15px] leading-relaxed text-text">{(items as string[]).map((i) => <li key={i} className="flex gap-2"><span className="text-blue">•</span>{i}</li>)}</ul>
          </div>
        ))}
      </section>

      <section id="pilot" className="bg-ink text-white">
        <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-10 px-4 py-16 md:px-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="font-display text-[32px] font-extrabold leading-tight tracking-tight">First semester free for three pilot campuses.</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[#C9D3E4]">We set up your school&apos;s email domain, add your counselors, and your students get Pro the day they sign up. After the pilot, pricing is per campus with unlimited students. Community colleges and schools without big-name recruiting pipelines first.</p>
            <ul className="mt-5 flex flex-col gap-2 text-[15px] text-[#C9D3E4]"><li>• Setup takes a day. No integration with your systems needed.</li><li>• Students sign up with their school email; nothing to roster.</li><li>• Cancel any time; students keep free Rails.</li></ul>
          </div>
          <div className="rounded-2xl bg-surface p-6 text-ink">
            {sp.sent ? (
              <div className="py-10 text-center"><div className="font-display text-[22px] font-extrabold">Got it.</div><p className="mt-2 text-[15px] text-text">We&apos;ll reply within two business days.</p></div>
            ) : (
              <form action={requestPilot} className="flex flex-col gap-3">
                <h3 className="font-display text-[18px] font-extrabold">Request a pilot</h3>
                {sp.err && <p className="rounded-lg bg-red-chip px-3 py-2 text-[13px] text-red-chip-text">Name, school and a valid email, please.</p>}
                <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                <label className="flex flex-col gap-1 text-[13px] font-semibold">Your name<input name="name" required className={input} autoComplete="name" /></label>
                <label className="flex flex-col gap-1 text-[13px] font-semibold">Work email<input name="email" type="email" required className={input} autoComplete="email" /></label>
                <label className="flex flex-col gap-1 text-[13px] font-semibold">School and campus<input name="school" required className={input} /></label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-[13px] font-semibold">Your role<input name="role" className={input} placeholder="Career counselor" /></label>
                  <label className="flex flex-col gap-1 text-[13px] font-semibold">STEM students, roughly<input name="students" className={input} placeholder="e.g. 800" /></label>
                </div>
                <label className="flex flex-col gap-1 text-[13px] font-semibold">Anything we should know<textarea name="note" rows={3} className="rounded-xl border border-line-strong px-3 py-2 text-[15px]" /></label>
                <button className="mt-1 h-12 rounded-xl bg-orange text-[15px] font-extrabold text-ink shadow-[var(--shadow-cta)]">Request a pilot</button>
              </form>
            )}
          </div>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
