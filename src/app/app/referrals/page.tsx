import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { CopyButton } from "@/components/copy-button";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { peopleSearches } from "@/lib/referrals/people";
import { planOf } from "@/lib/billing/entitlements";
import { addContact, draftFor, removeContact, saveDraft, setContactStatus } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { to_ask: "Not asked yet", asked: "Asked", replied: "Replied", referred: "Referred", no_reply: "No reply" };
const STATUS_TONE: Record<string, string> = { to_ask: "bg-g2 text-g7", asked: "bg-blue-chip text-blue-chip-text", replied: "bg-amber-chip text-amber-chip-text", referred: "bg-green-chip text-green-chip-text", no_reply: "bg-g2 text-muted" };
const REL_LABEL: Record<string, string> = { alum: "Alum", recruiter: "Recruiter", team: "On the team", other: "Other" };

type Contact = { id: string; company: string; name: string; role: string | null; link: string | null; relation: string; channel: string; status: string; draft: string | null; asked_at: string | null; next_nudge_at: string | null; job_id: string | null };

export default async function Referrals({ searchParams }: { searchParams: Promise<{ company?: string; limit?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/referrals");
  const [{ data: profile }, { data: credits }, { data: apps }, { data: rows }, plan] = await Promise.all([
    supabase.from("profiles").select("full_name,onboarding_done,canonical").eq("id", user.id).single(),
    supabase.from("credits").select("balance").eq("user_id", user.id).maybeSingle(),
    supabase.from("applications").select("job_id,company_name,title,stage").eq("user_id", user.id).order("last_activity_at", { ascending: false }).limit(60),
    supabase.from("referral_contacts").select("id,company,name,role,link,relation,channel,status,draft,asked_at,next_nudge_at,job_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(300),
    planOf(supabase, user.id),
  ]);
  if (!profile?.onboarding_done) redirect("/onboarding");
  const me = CanonicalProfile.safeParse(profile.canonical);
  const school = me.success ? me.data.education[0]?.school ?? null : null;
  const companies = [...new Set((apps ?? []).filter((a) => a.stage !== "rejected" && a.stage !== "withdrawn").map((a) => a.company_name))];
  const company = sp.company ?? companies[0] ?? "";
  const app = (apps ?? []).find((a) => a.company_name === company);
  const contacts = (rows ?? []) as Contact[];
  const here = contacts.filter((c) => c.company.toLowerCase() === company.toLowerCase());
  const now = new Date().getTime();
  const nudges = contacts.filter((c) => c.status === "asked" && c.next_nudge_at && Date.parse(c.next_nudge_at) <= now);
  const referred = contacts.filter((c) => c.status === "referred").length, asked = contacts.filter((c) => c.status !== "to_ask").length;
  const searches = company ? peopleSearches(company, app?.title ?? null, school) : [];
  const input = "h-10 rounded-xl border border-line-strong bg-surface px-3 text-[14px]";

  return (
    <AppShell active="/app/referrals" name={profile.full_name} credits={credits?.balance ?? 3} wide>
      <div className="pb-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-ink">Referrals</h1>
            <p className="mt-1 text-[14px] text-muted">Find the right people, send a note that asks for advice, track who answered. You send every message; Rails never contacts anyone.</p>
          </div>
          <div className="text-[13px] text-muted"><b className="text-ink">{asked}</b> asked · <b className="text-ink">{referred}</b> referred</div>
        </div>

        {nudges.length > 0 && <div className="mt-4 rounded-xl bg-amber-chip px-4 py-2.5 text-[13px] text-amber-chip-text"><b>{nudges.length} nudge{nudges.length === 1 ? "" : "s"} due:</b> {nudges.slice(0, 4).map((c) => `${c.name} (${c.company})`).join(", ")}. One short follow-up after 6 quiet days is normal; after that, let it go.</div>}
        {sp.limit && <div className="mt-4 rounded-xl bg-amber-chip px-4 py-2.5 text-[13px] text-amber-chip-text">Free includes one drafted note a day. <Link href="/pricing?reason=referrals" className="font-bold underline">Pro drafts unlimited</Link>, or write this one yourself below.</div>}

        <form className="mt-5 flex flex-wrap items-center gap-2" action="/app/referrals">
          <label htmlFor="company" className="text-[13px] font-semibold text-ink">Company</label>
          <input id="company" name="company" list="companies" defaultValue={company} placeholder="Type a company" className={`${input} w-64`} />
          <datalist id="companies">{companies.map((c) => <option key={c} value={c} />)}</datalist>
          <button className="h-10 rounded-xl bg-ink px-4 text-[14px] font-bold text-white">Show</button>
          {companies.slice(0, 6).map((c) => <Link key={c} href={`?company=${encodeURIComponent(c)}`} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${c === company ? "border-ink bg-ink text-white" : "border-line text-ink hover:border-ink"}`}>{c}</Link>)}
        </form>

        {company ? (
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
            <section className="flex min-w-0 flex-col gap-4">
              <h2 className="font-display text-[28px] font-extrabold leading-tight tracking-tight text-ink">Who can get you in at {company}.</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {searches.map((s) => (
                  <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)] hover:border-ink">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-blue">{REL_LABEL[s.relation]}</div>
                    <div className="mt-1 font-semibold text-ink">{s.label} ↗</div>
                    <div className="mt-1 text-[13px] text-muted">{s.why}</div>
                  </a>
                ))}
              </div>
              <p className="text-[12px] text-muted">Opens LinkedIn search in your browser. Found someone? Add them below so Rails can draft the note and remind you to follow up.</p>

              <form action={addContact} className="grid grid-cols-1 gap-2 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2">
                <input type="hidden" name="company" value={company} /><input type="hidden" name="job" value={app?.job_id ?? ""} />
                <input name="name" required placeholder="Name" aria-label="Name" className={input} />
                <input name="role" placeholder="Their role, e.g. Help Desk Analyst" aria-label="Role" className={input} />
                <input name="link" placeholder="LinkedIn or email link (optional)" aria-label="Link" className={`${input} sm:col-span-2`} />
                <select name="relation" defaultValue="alum" aria-label="How you're connected" className={input}>{Object.entries(REL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <select name="channel" defaultValue="linkedin" aria-label="Channel" className={input}><option value="linkedin">LinkedIn note</option><option value="email">Email</option><option value="other">Other</option></select>
                <button className="h-10 rounded-xl bg-ink text-[14px] font-bold text-white sm:col-span-2">Add contact</button>
              </form>

              <ul className="flex flex-col gap-3">
                {here.map((c) => (
                  <li key={c.id} className="rounded-2xl border border-line bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0"><div className="font-semibold text-ink">{c.link ? <a href={c.link} target="_blank" rel="noopener noreferrer" className="hover:underline">{c.name} ↗</a> : c.name}</div><div className="text-[13px] text-muted">{c.role ?? "Role unknown"} · {REL_LABEL[c.relation]}</div></div>
                      <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${STATUS_TONE[c.status]}`}>{STATUS_LABEL[c.status]}{c.status === "asked" && c.next_nudge_at ? ` · nudge ${new Date(c.next_nudge_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}</span>
                    </div>
                    {c.draft ? (
                      <form action={saveDraft} className="mt-3 flex flex-col gap-2">
                        <input type="hidden" name="id" value={c.id} />
                        <textarea name="draft" defaultValue={c.draft} rows={4} aria-label="Draft" className="rounded-xl border border-line bg-ground px-3 py-2 text-[14px] leading-relaxed" />
                        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                          <span className="font-mono">{c.draft.length}{c.channel === "linkedin" ? " / 300" : ""}</span>
                          <button className="rounded-full border border-line px-3 py-1.5 font-bold text-ink hover:border-ink">Save edit</button>
                          <CopyButton text={c.draft} label="Copy" small />
                          {c.link && <a href={c.link} target="_blank" rel="noopener noreferrer" className="rounded-full bg-ink px-3 py-1.5 font-bold text-white">Open profile ↗</a>}
                        </div>
                      </form>
                    ) : (
                      <form action={draftFor} className="mt-3"><input type="hidden" name="id" value={c.id} /><button className="rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-white">Draft a note{plan === "free" ? " · 1 a day on Free" : ""}</button></form>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                      {Object.entries(STATUS_LABEL).filter(([k]) => k !== c.status).map(([k, l]) => (
                        <form key={k} action={setContactStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value={k} /><button className="rounded-full border border-line px-2.5 py-1 text-[12px] font-semibold text-ink hover:border-ink">{k === "asked" ? "I sent it" : l}</button></form>
                      ))}
                      <form action={removeContact} className="ml-auto"><input type="hidden" name="id" value={c.id} /><button className="text-[12px] font-semibold text-muted hover:text-red">Remove</button></form>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <aside className="flex flex-col gap-4">
              <div className="rounded-2xl border border-line bg-surface p-5 text-[14px] leading-relaxed text-text">
                <h3 className="font-display text-[15px] font-extrabold text-ink">How to ask</h3>
                <ul className="mt-2 list-disc space-y-1.5 pl-5">
                  <li>Ask for 10 minutes of advice, not a referral. People who talk to you tend to offer the referral themselves.</li>
                  <li>One true, specific link between you: same school, same program, same kind of work.</li>
                  <li>No resume on a first note. Send it when they ask.</li>
                  <li>No reply in 6 days: one short nudge. Then move on.</li>
                  <li>If they refer you, thank them and tell them how it went, whatever happens.</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-5">
                <h3 className="font-display text-[15px] font-extrabold text-ink">All your outreach</h3>
                {contacts.length === 0 ? <p className="mt-2 text-[13px] text-muted">Nobody yet.</p> : (
                  <ul className="mt-2 divide-y divide-line text-[13px]">{contacts.slice(0, 20).map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-2"><Link href={`?company=${encodeURIComponent(c.company)}`} className="min-w-0 truncate hover:underline"><b className="text-ink">{c.company}</b> · {c.name}</Link><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[c.status]}`}>{STATUS_LABEL[c.status]}</span></li>
                  ))}</ul>
                )}
              </div>
            </aside>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center text-[14px] text-muted">Type a company above, or apply to a few jobs and they show up here.</div>
        )}
      </div>
    </AppShell>
  );
}
