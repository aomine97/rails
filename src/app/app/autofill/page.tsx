import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { CanonicalProfile } from "@/lib/schemas/profile";
import { fillFields } from "@/lib/ext/fields";
import { applyPrefs, readPrefs } from "@/lib/ext/prefs";
import { savePrefs } from "./actions";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="grid grid-cols-[150px_1fr] gap-3 border-b border-line py-2 text-[14px] last:border-0"><dt className="text-muted">{label}</dt><dd className={value ? "text-ink" : "text-amber"}>{value || "Missing: add it to your profile"}</dd></div>;
}

export default async function AutofillSettings() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/autofill");
  const [{ data: p }, { data: credits }, { data: events }] = await Promise.all([
    supabase.from("profiles").select("full_name,onboarding_done,canonical,autofill_prefs,ext_token").eq("id", user.id).single(),
    supabase.from("credits").select("balance").eq("user_id", user.id).maybeSingle(),
    supabase.from("fill_events").select("domain,success,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1000),
  ]);
  if (!p?.onboarding_done) redirect("/onboarding");
  const parsed = CanonicalProfile.safeParse(p.canonical); if (!parsed.success) redirect("/onboarding");
  const prefs = readPrefs(p.autofill_prefs);
  const f = applyPrefs(fillFields(parsed.data), prefs);
  const sites = new Map<string, { ok: number; n: number; last: string }>();
  for (const e of events ?? []) { const s = sites.get(e.domain) ?? { ok: 0, n: 0, last: e.created_at }; s.n++; if (e.success) s.ok++; sites.set(e.domain, s); }
  const siteRows = [...sites.entries()].sort((a, b) => Date.parse(b[1].last) - Date.parse(a[1].last)).slice(0, 12);
  const yn = (b: boolean | null) => (b == null ? null : b ? "Yes" : "No");
  const input = "h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-[14px]";
  const radio = "flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-ink has-[:checked]:bg-ground";

  return (
    <AppShell active="/app/autofill" name={p.full_name} credits={credits?.balance ?? 3}>
      <div className="pb-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-ink">Autofill</h1>
            <p className="mt-1 text-[14px] text-muted">What the extension puts in the form. Change it once here and every application after uses it.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${p.ext_token ? "bg-green-chip text-green-chip-text" : "bg-amber-chip text-amber-chip-text"}`}>{p.ext_token ? "Extension connected" : <Link href="/ext/connect" className="underline">Connect the extension</Link>}</span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between"><h2 className="font-display text-[15px] font-extrabold text-ink">Contact and basics</h2><Link href="/onboarding/confirm?next=/app/autofill" className="text-[13px] font-semibold text-blue">Edit</Link></div>
            <dl className="mt-2">
              <Row label="Legal name" value={f.fullName} />
              <Row label="Preferred name" value={f.preferredName ?? f.firstName} />
              <Row label="Email" value={f.email} />
              <Row label="Phone" value={f.phone} />
              <Row label="Address" value={[f.street, f.city, f.state, f.zip].filter(Boolean).join(", ") || null} />
              <Row label="LinkedIn" value={f.linkedin} />
              <Row label="School" value={f.school ? `${f.school}${f.degreeName ? `, ${f.degreeName}` : ""}${f.major ? ` in ${f.major}` : ""}` : null} />
              <Row label="Graduation" value={f.gradDate} />
              <Row label="Authorized to work" value={yn(f.workAuthorized)} />
              <Row label="Needs sponsorship" value={yn(f.needsSponsorship)} />
            </dl>
          </section>

          <form action={savePrefs} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-display text-[15px] font-extrabold text-ink">Screener answers and behavior</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink">Pay expectation<input name="payText" defaultValue={prefs.payText ?? ""} placeholder={f.desiredPay ?? "e.g. $24/hr or Negotiable"} className={input} /></label>
              <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink">Hours available<input name="hoursPerWeek" defaultValue={prefs.hoursPerWeek ?? ""} placeholder="e.g. 40/wk, or 20/wk during term" className={input} /></label>
              <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink">Willing to relocate
                <select name="relocate" defaultValue={prefs.relocate} className={input}><option value="auto">From my locations ({yn(fillFields(parsed.data).willRelocate) ?? "unknown"})</option><option value="yes">Yes</option><option value="no">No</option></select></label>
              <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink">Earliest start<input disabled value={f.earliestStart ?? ""} className={`${input} bg-ground text-muted`} /><span className="text-[11px] font-normal text-muted">Set on your profile.</span></label>
            </div>
            <fieldset className="flex flex-col gap-2"><legend className="text-[13px] font-semibold text-ink">How far it goes</legend>
              <label className={radio}><input type="radio" name="essays" value="draft" defaultChecked={prefs.essays === "draft"} className="mt-1" /><span><b className="text-ink">Fill and stop</b><br /><span className="text-[13px] text-muted">Everything filled, long answers drafted from your profile for you to read. You submit.</span></span></label>
              <label className={radio}><input type="radio" name="essays" value="skip" defaultChecked={prefs.essays === "skip"} className="mt-1" /><span><b className="text-ink">Fill, skip the essays</b><br /><span className="text-[13px] text-muted">Leaves long answers blank for you to write.</span></span></label>
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-line p-3 text-[13px] text-muted"><span className="mt-0.5">✕</span><span><b className="text-ink">Submit for me</b> isn&apos;t offered. Employers filter bot submissions out, and you should read what goes out under your name.</span></div>
            </fieldset>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink">Resume it attaches
                <select name="resume" defaultValue={prefs.resume} className={input}><option value="tailored">Tailored for the job when there is one</option><option value="base">Always my base resume</option></select></label>
              <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink">Cover letter
                <select name="coverLetter" defaultValue={prefs.coverLetter} className={input}><option value="when_asked">When the form asks and I made one</option><option value="never">Never attach one</option></select></label>
            </div>
            <button className="h-11 self-start rounded-xl bg-ink px-5 text-[14px] font-bold text-white">Save</button>
          </form>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-display text-[15px] font-extrabold text-ink">Sites</h2>
            {siteRows.length === 0 ? <p className="mt-2 text-[13px] text-muted">No fills yet. Open an application and press Autofill in the Rails drawer.</p> : (
              <ul className="mt-2 divide-y divide-line text-[13px]">{siteRows.map(([d, s]) => (
                <li key={d} className="flex items-center justify-between gap-3 py-2"><span className="truncate font-semibold text-ink">{d}</span><span className="shrink-0 font-mono text-[12px] text-muted">{s.ok}/{s.n} fields · {Math.round((100 * s.ok) / s.n)}%</span></li>
              ))}</ul>
            )}
            <p className="mt-3 text-[12px] text-muted">Corrected a field yourself? The extension saves the fix for that site and stops getting it wrong.</p>
          </section>
          <section className="rounded-2xl border border-line bg-ink p-5 text-white">
            <h2 className="font-display text-[15px] font-extrabold">Stays on this device</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#C9D3E4]">Voluntary EEO answers (gender, race and ethnicity, veteran and disability status), the answers you save for reuse, and passwords the extension creates for job sites are stored in your browser only. Rails&apos; servers never receive them. Manage or clear them from the extension&apos;s drawer.</p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
