/** The autofill run, executed inside the page (content script). Nothing here touches the side panel, so it keeps going when the
 *  user switches tabs or closes the panel. Progress goes out through `onState`; the drawer and the panel both render it. */
import { api, getToken, type JobInfo, type Me } from "./api";
import { fillForm, atsOf, attachFile, type Values, type FillResult } from "./fill";
import { scanFields, readComboOptions, applyAnswer, type ScannedField } from "./scan";
import { answerKey, summary, type FormState, type Row } from "./form";
import { isWorkday, wdStep, wdFillInfo, wdFillExperience, wdFillDisclosures, type WdReport } from "./workday";
import { accountFor, saveAccount, generatePassword, accountForm } from "./accounts";
import { setValue } from "./fill";

export type RunFile = { kind: "resume" | "letter"; name: string; type: string; bytes: ArrayBuffer };
export type RunInput = { me: Me; job: JobInfo | null; files: RunFile[]; learned: Record<string, string[]> };
export type Saved = Record<string, string | string[] | boolean>;

export function allRoots(): (Document | ShadowRoot)[] {
  const roots: (Document | ShadowRoot)[] = [document];
  for (const el of document.querySelectorAll("*")) if (el.shadowRoot && !el.id.startsWith("rails-")) roots.push(el.shadowRoot);
  for (const f of document.querySelectorAll("iframe")) { try { const d = f.contentDocument; if (d) roots.push(d); } catch { /* cross-origin */ } }
  return roots;
}
const rootOf = (id: string) => allRoots().find((r) => r.querySelector(`[data-rails-f="${id}"]`)) ?? document;

export async function loadSaved(): Promise<Saved> { try { const r = await chrome.storage.local.get("rails_answers"); return (r.rails_answers ?? {}) as Saved; } catch { return {}; } }
export async function remember(label: string, v: string | string[] | boolean) { const s = await loadSaved(); s[answerKey(label)] = v; try { await chrome.storage.local.set({ rails_answers: s }); } catch { /* ignore */ } }
export const valueText = (v: string | string[] | boolean) => Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Yes" : "No") : v;

export function scanAll(): ScannedField[] { const out: ScannedField[] = []; for (const r of allRoots()) out.push(...scanFields(r)); return out; }

export function refresh(fs: FormState) {
  const byId = new Map(scanAll().map((f) => [f.id, f]));
  for (const r of fs.rows) { const f = byId.get(r.f.id); if (!f) continue; if (f.filled) { r.s = "done"; r.value = f.value; } else if (r.s === "done") r.s = r.f.conditional ? "skip" : "left"; }
  for (const f of byId.values()) if (!fs.rows.some((r) => r.f.id === f.id)) fs.rows.push({ f, s: f.filled ? "done" : f.conditional ? "skip" : "todo", value: f.value });
}

/** Gather what a run needs. Runs in the page with the token from extension storage. */
export async function prepare(): Promise<RunInput | { error: string }> {
  if (!(await getToken())) return { error: "not_connected" };
  let me: Me; try { me = await api.me(); } catch (e) { return { error: String((e as Error).message) }; }
  let job: JobInfo | null = null; try { job = (await api.job(location.href)).job; } catch { /* unknown page is fine */ }
  const files: RunFile[] = [];
  try { const r = await api.file("resume", job?.id); if (r) files.push({ kind: "resume", name: r.name, type: r.type, bytes: r.bytes }); } catch { /* none */ }
  if (job?.coverLetter) { try { const l = await api.file("letter", job.id); if (l) files.push({ kind: "letter", name: l.name, type: l.type, bytes: l.bytes }); } catch { /* none */ } }
  let learned: Record<string, string[]> = {}; try { learned = (await api.learned(location.hostname)).selectors; } catch { /* optional */ }
  return { me, job, files, learned };
}

/** One field from the user's pick in the drawer. */
export async function fillOne(fs: FormState, id: string, v: string | string[] | boolean, rememberIt = false): Promise<boolean> {
  const r = fs.rows.find((x) => x.f.id === id); if (!r) return false;
  r.s = "filling";
  let ok = false; try { ok = await applyAnswer(rootOf(id), r.f, v); } catch { ok = false; }
  if (!ok) { refresh(fs); ok = (r.s as string) === "done"; }
  r.s = ok ? "done" : "failed"; r.value = ok ? valueText(v) : r.value; r.why = ok ? undefined : "The page did not take that. Try another option or set it on the page.";
  if (ok && rememberIt) await remember(r.f.label, v);
  if (ok) refresh(fs);
  return ok;
}

export async function listOptions(fs: FormState, id: string) {
  const r = fs.rows.find((x) => x.f.id === id); if (!r) return;
  r.f.options = await readComboOptions(rootOf(id), r.f, 2500);
}

/** The whole flow: scan -> rules + files -> saved answers -> profile answers from the server -> list leftover dropdowns. */
export async function run(input: RunInput, fs: FormState, onState: (fs: FormState) => void): Promise<FormState> {
  const emit = () => onState(fs);
  const set = (step: string) => { fs.step = step; emit(); };
  fs.running = true; set("Reading the form…");
  const fields = scanAll();
  let budget = 14;
  for (const f of fields) if ((f.kind === "combobox" || f.kind === "listbox") && !f.filled && budget > 0) { budget--; f.options = await readComboOptions(rootOf(f.id), f); }
  fs.rows = fields.map((f) => ({ f, s: f.filled ? "done" : f.conditional ? "skip" : "todo", value: f.value }));
  if (!fs.rows.length) { fs.running = false; fs.step = "No form on this page yet."; emit(); return fs; }
  emit();

  // 0. Workday: the step's known controls first (listbox buttons, search selects, split dates, Add Another rows)
  if (isWorkday()) {
    const step = wdStep(); fs.wdStep = step;
    set(`Workday · ${step.label || step.key}…`);
    let rep: WdReport = [];
    const files = input.files.map((f) => ({ kind: f.kind, file: new File([f.bytes], f.name, { type: f.type }) }));
    try {
      // Decide by what is on the page, not by the step label: tenants rename and reorder steps.
      const has = (id: string) => !!document.querySelector(`[data-automation-id="${id}"]`);
      if (has("legalNameSection_firstName") || has("addressSection_addressLine1") || has("phone-number")) rep = rep.concat(await wdFillInfo(input.me, await loadSaved()));
      if (has("workExperienceSection") || has("educationSection") || has("skillsSection") || has("file-upload-input-ref")) rep = rep.concat(await wdFillExperience(input.me, files));
      if (has("gender") || has("ethnicityDropdown") || has("veteranStatus") || has("hispanicOrLatino")) rep = rep.concat(await wdFillDisclosures(await loadSaved()));
      if (accountForm().mode) rep = rep.concat(await fillAccount(input.me.fields.email as string, fs));
      else if (step.key === "start") { const r = files.find((x) => x.kind === "resume"); const inp = document.querySelector<HTMLInputElement>('input[data-automation-id="file-upload-input-ref"], input[type="file"]'); if (r && inp && !rep.some((x) => x.key === "resume")) { try { const dt = new DataTransfer(); dt.items.add(r.file); inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true })); rep = [{ key: "resume", success: true, label: `Resume uploaded for Workday's own parser: ${r.file.name}` }]; } catch { /* left */ } } }
    } catch (e) { fs.error = `Workday step failed: ${String((e as Error).message)}`; }
    for (const r of rep) fs.rows.unshift({ f: { id: `wd:${r.key}`, label: r.label, kind: "text", required: true, filled: r.success, sensitive: false, conditional: false }, s: r.success ? "done" : "left", why: r.success ? undefined : "Set this one on the page." });
    emit();
  }

  // 0b. Any other ATS with a sign-in / create-account form (iCIMS, Oracle, Taleo, SuccessFactors): same password-manager behavior.
  if (!isWorkday() && accountForm().mode) {
    set("Account…");
    const rep = await fillAccount(input.me.fields.email as string, fs);
    for (const r of rep) fs.rows.unshift({ f: { id: `acct:${r.key}`, label: r.label, kind: "text", required: true, filled: r.success, sensitive: false, conditional: false }, s: r.success ? "done" : "left" });
    emit();
  }

  // 1. rules + files
  set("Filling your details…");
  const ats = atsOf(location.hostname); const values = { ...(input.me.fields as Values), coverLetterText: input.job?.coverLetter ?? null };
  let results: FillResult[] = []; let left: string[] = [];
  for (const r of allRoots()) { const rep = await fillForm(r, values, { ats, learned: input.learned }); results = results.concat(rep.results); left = left.concat(rep.leftForYou); }
  for (const f of input.files) { const file = new File([f.bytes], f.name, { type: f.type }); for (const r of allRoots()) { const a = attachFile(r, f.kind, file); if (a.success) { results.push({ key: (f.kind === "resume" ? "resumeFile" : "letterFile") as unknown as FillResult["key"], selector: a.selector, strategy: "file", success: true }); break; } } }
  try { await api.fillReport({ url: location.href, jobId: input.job?.id, leftForYou: left, fields: results }); } catch { /* best effort */ }
  refresh(fs); emit();

  // 2. saved answers (client only)
  const saved = await loadSaved();
  const todo = () => fs.rows.filter((r) => r.s === "todo" && r.f.kind !== "file");
  const fromSaved = todo().filter((r) => saved[answerKey(r.f.label)] !== undefined);
  if (fromSaved.length) { set("Using your saved answers…"); for (const r of fromSaved) { const v = saved[answerKey(r.f.label)]!; r.s = "filling"; emit(); const ok = await applyAnswer(rootOf(r.f.id), r.f, v).catch(() => false); r.s = ok ? "done" : "left"; r.value = valueText(v); emit(); } }

  // 2b. "How did you hear about us": never sent to the server; saved answer, else the first honest option the page offers
  for (const r of todo().filter((r) => /how did you (hear|learn|find)/i.test(r.f.label))) {
    if (!r.f.options?.length && (r.f.kind === "listbox" || r.f.kind === "combobox")) r.f.options = await readComboOptions(rootOf(r.f.id), r.f, 2500);
    const pref = ["job board", "online job board", "job search", "company website", "career site", "website", "internet", "online", "other"];
    const pick = pref.map((p) => r.f.options?.find((o) => o.toLowerCase().includes(p))).find(Boolean);
    if (!pick) continue;
    r.s = "filling"; emit();
    const ok = await applyAnswer(rootOf(r.f.id), r.f, pick).catch(() => false);
    r.s = ok ? "done" : "left"; r.value = pick; r.assumed = ok; r.why = ok ? `Picked "${pick}". Change it below and tick Remember if you'd rather say something else.` : undefined; emit();
  }

  // 3. profile answers from the server (EEO never leaves the page)
  const ask = todo().filter((r) => !r.f.sensitive && !r.f.legal);
  for (const r of todo().filter((r) => r.f.sensitive)) { r.s = "left"; r.why = "Yours to answer. Tick Remember and it fills next time."; }
  for (const r of todo().filter((r) => r.f.legal)) { r.s = "left"; r.why = "Read it, then tick it here or on the page."; }
  if (ask.length) {
    set(`Answering ${ask.length} question${ask.length === 1 ? "" : "s"} from your profile…`);
    try {
      const { answers } = await api.answers({ url: location.href, company: input.job?.company, title: input.job?.title, questions: ask.map((r) => ({ id: r.f.id, label: r.f.label, kind: r.f.kind, options: r.f.options?.slice(0, 80), required: r.f.required })) });
      for (const r of ask) {
        const a = answers.find((x) => x.id === r.f.id);
        if (!a || a.value == null) { r.s = "left"; r.why = a?.why || "Not in your profile"; emit(); continue; }
        r.s = "filling"; emit();
        const ok = await applyAnswer(rootOf(r.f.id), r.f, a.value).catch(() => false);
        if (ok) { r.s = "done"; r.value = valueText(a.value); r.why = a.assumed ? `Assumed ${valueText(a.value)} because your profile shows nothing else. Change it below if that's wrong.` : a.why; r.assumed = !!a.assumed; } else { r.s = "failed"; r.why = `Suggested "${valueText(a.value)}" but the page did not take it.`; r.value = valueText(a.value); }
        emit();
      }
    } catch (e) { for (const r of ask) if (r.s === "todo") { r.s = "left"; r.why = "Answer service unavailable"; } fs.error = `Could not answer questions: ${String((e as Error).message)}`; }
  }
  for (const r of fs.rows) if (r.s === "todo") r.s = "left";
  refresh(fs);
  const unlisted = fs.rows.filter((r) => (r.s === "left" || r.s === "failed" || r.assumed) && (r.f.kind === "combobox" || r.f.kind === "listbox") && !r.f.options?.length && !r.f.searchable).slice(0, 16);
  if (unlisted.length) { set("Reading the remaining dropdowns…"); for (const r of unlisted) r.f.options = await readComboOptions(rootOf(r.f.id), r.f, 2500); }
  fs.running = false; fs.step = ""; fs.filledAt = Date.now(); emit();
  const sm = summary(fs); fs.summaryText = `${sm.done}/${sm.req} required filled`;
  return fs;
}

/** Sign in with the account saved for this tenant, or create one: email + a generated password, stored only in this browser.
 *  The Create Account / Sign In click is the user's unless "create accounts for me" is on. */
export async function fillAccount(email: string, fs: FormState): Promise<WdReport> {
  const form = accountForm(); if (!form.mode || !form.password) return [];
  let acct = await accountFor();
  if (form.mode === "signin") {
    if (!acct) { fs.error = "No saved account for this site. Use Create Account (Rails will make the password) or sign in yourself."; return [{ key: "account", success: false, label: "Sign in: no saved account for this site" }]; }
    const ok = (form.email ? setValue(form.email, acct.email) : true) && setValue(form.password, acct.password);
    fs.account = { email: acct.email, password: acct.password, mode: "signin" };
    return [{ key: "account", success: ok, label: `Sign in as ${acct.email} (saved on this computer)` }];
  }
  if (!acct) { acct = { email, password: generatePassword(), createdAt: Date.now(), host: location.hostname }; await saveAccount(acct); }
  const ok = (form.email ? setValue(form.email, acct.email) : true) && setValue(form.password, acct.password) && (form.verify ? setValue(form.verify, acct.password) : true);
  fs.account = { email: acct.email, password: acct.password, mode: "create" };
  const auto = (await chrome.storage.local.get("rails_auto_accounts").catch(() => ({} as Record<string, unknown>))).rails_auto_accounts === true;
  if (ok && auto && form.submit) { if (form.terms && !form.terms.checked) form.terms.click(); form.submit.click(); }
  return [{ key: "account", success: ok, label: `Create account: ${acct.email} + generated password (saved on this computer)` }, ...(form.terms ? [{ key: "terms", success: auto, label: "Terms checkbox" }] : [])];
}

/** What the user changed by hand after we filled: remembered for the next application on any site. */
export async function learnCorrections(fs: FormState): Promise<number> {
  const byId = new Map(scanAll().map((f) => [f.id, f]));
  let n = 0;
  for (const r of fs.rows) {
    if (r.s !== "done" || !r.value) continue;
    const now = byId.get(r.f.id); if (!now?.filled || !now.value) continue;
    if (now.value.trim() !== r.value.trim() && r.f.kind !== "file" && r.f.label.length < 140) { await remember(r.f.label, r.f.kind === "checkboxes" ? now.value.split(", ") : now.value); n++; }
  }
  return n;
}

export type { Row, ScannedField };
