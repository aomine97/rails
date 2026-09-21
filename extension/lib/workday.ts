/** Workday: one adapter for every tenant. Workday stamps each control with data-automation-id and the ids are the same on
 *  Nvidia, Lockheed, Capital One, Salesforce, ... The apply flow is a multi-step SPA: My Information -> My Experience ->
 *  Application Questions -> Voluntary Disclosures -> Self Identify -> Review. This file fills one step; the runner is told which. */
import { clean, sleep, setValue, mouse, clickLike, pressKey, type Values } from "./fill";
import { pickFromListbox, closeLists, openOptions as listboxOptions } from "./listbox";
import type { Me, MeExperience, MeEducation } from "./api";

export const isWorkday = (host = location.hostname) => /myworkdayjobs\.com$|myworkdaysite\.com$|myworkday\.com$/.test(host);
export type WdStep = { index: number; total: number; label: string; key: "start" | "account" | "info" | "experience" | "questions" | "disclosures" | "identify" | "review" | "unknown" };

const PAGE_MARKERS: [string, WdStep["key"]][] = [
  ["contactInformationPage", "info"], ["myExperiencePage", "experience"], ["voluntaryDisclosuresPage", "disclosures"],
  ["selfIdentificationPage", "identify"], ["reviewPage", "review"], ["applicationQuestionsPage", "questions"], ["questionnairePage", "questions"],
];
/** Which step this is. Page markers are reliable across tenants; the progress bar is only a label source. */
export function wdStep(): WdStep {
  const bar = document.querySelector('[data-automation-id="progressBar"]');
  const items = bar ? [...bar.querySelectorAll('[data-automation-id="progressBarActiveStep"], [data-automation-id="progressBarInactiveStep"], [data-automation-id="progressBarCompletedStep"], li')] : [];
  const active = bar?.querySelector('[data-automation-id="progressBarActiveStep"]') ?? bar?.querySelector('[aria-current="step"], [aria-current="true"]');
  const label = clean(active?.textContent) || clean(document.querySelector('h2[data-automation-id="pageHeaderTitle"], h2, h1')?.textContent) || "";
  let key: WdStep["key"] = "unknown";
  for (const [marker, k] of PAGE_MARKERS) if (document.querySelector(`[data-automation-id="${marker}"]`)) { key = k; break; }
  if (key === "unknown") {
    key = document.querySelector('[data-automation-id="createAccountSubmitButton"], [data-automation-id="signInSubmitButton"]') || document.querySelector('input[type="password"]') ? "account"
      : document.querySelector('[data-automation-id="applyManually"], [data-automation-id="autofillWithResume"], [data-automation-id="adventureButton"]') ? "start"
      : /information/i.test(label) ? "info" : /experience/i.test(label) ? "experience" : /question/i.test(label) ? "questions"
      : /disclosure/i.test(label) ? "disclosures" : /identify/i.test(label) ? "identify" : /review/i.test(label) ? "review" : "unknown";
  }
  const idx = items.findIndex((i) => i === active || i.contains(active as Node));
  return { index: idx >= 0 ? idx + 1 : 0, total: items.length, label, key };
}

const byAuto = (id: string, root: ParentNode = document) => root.querySelector<HTMLElement>(`[data-automation-id="${id}"]`);
/** Workday wraps each field in div[data-automation-id="formField-<name>"] with the control nested inside. */
export const byField = (name: string, root: ParentNode = document) => root.querySelector<HTMLElement>(`[data-automation-id="formField-${name}"]`);
/** The control for a field, whether the tenant stamps the id on the control or only on the wrapper. */
const controlFor = (name: string, root: ParentNode = document): HTMLElement | null => byAuto(name, root) ?? byField(name, root);
const inputOf = (el: Element | null): HTMLInputElement | HTMLTextAreaElement | null => !el ? null : el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : el.querySelector("input, textarea");
const norm = (s: string | null | undefined) => clean(s).toLowerCase();
const matches = (t: string, w: string) => { const a = norm(t), b = norm(w); if (!a || !b) return false; return a === b || a.startsWith(b) || (b.length > 3 && a.includes(b)) || (a.length > 3 && b.startsWith(a)) || (/^(yes|no)$/.test(b) && new RegExp(`^${b}\\b`).test(a)); };
/** "Associate's Degree" -> ["Associate's Degree", "Associate's", "Associate", "AAS"]: try the long name, then its first word, then the code. */
const degreeGuesses = (name: string | null | undefined, code: string | null | undefined) => [...new Set([name, name?.replace(/\s+degree$/i, ""), name?.split(/[\s']/)[0], code].filter((x): x is string => !!x))];

/** Text input by automation id (or within a row). */
export type Tri = boolean | null; // null = that control is not on this page, so it is not the user's problem
export function wdText(id: string, value: string | null | undefined, root: ParentNode = document): Tri {
  const el = inputOf(controlFor(id, root)); if (!el) return null;
  if (value == null || value === "") return false;
  if (el.value && el.value.trim() && el.value.trim() !== value) return true; // never overwrite what the user typed
  return setValue(el, value);
}

/** Workday dropdown. Driving it lives in lib/listbox.ts so the generic scanner and this adapter behave identically. */
export async function wdListbox(id: string, want: string | null | undefined, root: ParentNode = document, budgetMs = 3000): Promise<Tri> {
  const host = controlFor(id, root);
  const btn = (host?.matches("button") ? host : host?.querySelector("button")) as HTMLElement | null; if (!btn) return null;
  if (want == null || want === "") return false;
  return pickFromListbox(btn, want, { budgetMs });
}

/** Search-as-you-type multi/single select (school, field of study, country phone code, skills): type, wait for promptOption, pick, verify the chip. */
export async function wdSearch(id: string, want: string | null | undefined, root: ParentNode = document, budgetMs = 6000): Promise<Tri> {
  const box = controlFor(id, root); const input = inputOf(box) ?? (box?.matches("input") ? (box as HTMLInputElement) : null); if (!input) return null;
  if (want == null || want === "") return false;
  const scope = box ?? input.parentElement ?? document;
  const chips = () => [...scope.querySelectorAll('[data-automation-id="selectedItem"], [data-automation-id="selectedItemList"] li, [data-automation-id="DELETE_charm"]')].map((c) => norm(c.textContent)).filter(Boolean);
  const chosen = () => chips().some((c) => matches(c, want)) || /\b[1-9]\d* items? selected/.test(clean(scope.textContent));
  if (chosen()) return true;
  await closeLists();
  try { input.scrollIntoView({ block: "center" }); } catch { /* jsdom */ }
  input.focus(); setValue(input, want);
  // Workday searches on the first Enter and accepts the highlighted result on the second.
  pressKey(input, "Enter");
  const t0 = Date.now(); let opts: HTMLElement[] = [];
  while (Date.now() - t0 < budgetMs) { await sleep(200); opts = listboxOptions(); if (opts.length) break; if (chosen()) return true; }
  const hit = opts.find((o) => norm(o.textContent) === norm(want)) ?? opts.find((o) => matches(o.textContent ?? "", want)) ?? (opts.length === 1 ? opts[0] : null);
  if (hit) { clickLike(hit); await sleep(250); if (chosen()) return true; }
  pressKey(input, "Enter"); await sleep(400);
  if (chosen()) return true;
  await closeLists();
  return false;
}

/** Split date: <prefix>-dateSectionMonth-input / -dateSectionYear-input (spinbuttons that take typed digits). ym = "2025-08" or "2027". */
export function wdDate(field: string, ym: string | null | undefined, root: ParentNode = document): Tri {
  // The prefix is on the wrapper (formField-startDate); the spinbuttons inside are dateSectionMonth-input / -Year-input.
  const scope: ParentNode = byField(field, root) ?? byAuto(field, root) ?? root;
  const yEl = inputOf(scope.querySelector('[data-automation-id="dateSectionYear-input"]') ?? byAuto(`${field}-dateSectionYear-input`, root));
  const mEl = inputOf(scope.querySelector('[data-automation-id="dateSectionMonth-input"]') ?? byAuto(`${field}-dateSectionMonth-input`, root));
  const plain = !yEl && !mEl ? inputOf(scope === root ? null : (scope as HTMLElement)) : null; // education years are a single plain input
  if (!yEl && !mEl && !plain) return null;
  if (!ym) return false;
  const [y, m] = ym.split("-");
  const type = (el: HTMLInputElement | HTMLTextAreaElement | null, v: string) => { if (!el) return false; el.focus(); const r = setValue(el, v); pressKey(el, v.slice(-1)); el.blur(); return r; };
  if (plain) return type(plain, y ?? ym);
  let ok = false;
  if (mEl && m) ok = type(mEl, String(Number(m))) || ok;
  if (yEl && y) ok = type(yEl, y) || ok;
  return ok;
}

export function wdCheckbox(id: string, want: boolean, root: ParentNode = document): Tri {
  const el = inputOf(controlFor(id, root)) as HTMLInputElement | null; if (!el || el.type !== "checkbox") return null;
  if (el.checked !== want) el.click(); return el.checked === want;
}
export function wdRadio(id: string, want: string, root: ParentNode = document): Tri {
  const group = controlFor(id, root); if (!group) return null;
  const radios = [...group.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
  const hit = radios.find((r) => matches(r.closest("label")?.textContent ?? group.querySelector(`label[for="${r.id}"]`)?.textContent ?? "", want) || matches(r.value, want));
  if (!hit) return false; if (!hit.checked) hit.click(); return hit.checked;
}

/** "Add" / "Add Another" inside a section until it has n rows. Rows are [data-automation-id^="<prefix>-"] (workExperience-1, education-2). */
export async function wdEnsureRows(sectionId: string, rowPrefix: string, n: number): Promise<HTMLElement[]> {
  const section = byAuto(sectionId); if (!section) return [];
  const rows = () => [...section.querySelectorAll<HTMLElement>(`[data-automation-id^="${rowPrefix}-"]`)].filter((r) => /-\d+$/.test(r.getAttribute("data-automation-id") ?? ""));
  for (let i = 0; i < 6 && rows().length < n; i++) {
    const add = [...section.querySelectorAll<HTMLElement>('button[data-automation-id*="add" i], button[aria-label*="add" i]')].filter((b) => /add/i.test(b.textContent ?? b.getAttribute("aria-label") ?? "") || /add/i.test(b.getAttribute("data-automation-id") ?? "")).pop(); if (!add) break;
    clickLike(add); await sleep(400);
  }
  return rows().slice(0, n);
}

export type WdReport = { key: string; success: boolean; label: string }[];
/** Only controls that exist on this page become rows; a tenant that has no "preferred name" field never shows one to fill. */
const push = (rep: WdReport, key: string, ok: Tri, label: string) => { if (ok !== null) rep.push({ key, success: ok, label }); };

/** My Information page. */
export async function wdFillInfo(me: Me, saved: Record<string, unknown>): Promise<WdReport> {
  const f = me.fields as Values; const rep: WdReport = [];
  const src = (saved["how did you hear about us"] as string) ?? (saved["how did you hear about this job"] as string) ?? (saved["source"] as string) ?? null;
  let srcOk: Tri = null; for (const want of [src, "Job Board", "Online Job Board", "Company Website", "Other"].filter(Boolean) as string[]) { const a = await wdSearch("sourceSection", want, document, 2500); const b = a === true ? true : await wdListbox("sourceSection", want); if (a === null && b === null) { srcOk = null; break; } srcOk = a === true || b === true; if (srcOk) break; }
  push(rep, "sourceSection", srcOk, "How did you hear about us");
  push(rep, "country", await wdListbox("countryDropdown", "United States of America"), "Country");
  push(rep, "firstName", wdText("legalNameSection_firstName", f.firstName as string), "Legal first name");
  push(rep, "lastName", wdText("legalNameSection_lastName", f.lastName as string), "Legal last name");
  if (f.preferredName) push(rep, "preferredName", wdText("preferredNameSection_firstName", f.preferredName as string), "Preferred name");
  push(rep, "street", wdText("addressSection_addressLine1", f.street as string), "Address line 1");
  push(rep, "city", wdText("addressSection_city", f.city as string), "City");
  push(rep, "state", await wdListbox("addressSection_countryRegion", (f.stateName as string) ?? (f.state as string)), "State");
  push(rep, "zip", wdText("addressSection_postalCode", f.zip as string), "Postal code");
  push(rep, "email", wdText("email", f.email as string), "Email");
  push(rep, "phoneType", await wdListbox("phone-device-type", "Mobile"), "Phone device type");
  { const a = await wdSearch("countryPhoneCode", "United States of America (+1)", document, 4000); push(rep, "phoneCountry", a === true ? true : a === null ? await wdListbox("countryPhoneCode", "United States of America") : (await wdListbox("countryPhoneCode", "United States of America")) === true, "Phone country code"); }
  push(rep, "phone", wdText("phone-number", String(f.phone ?? "").replace(/\D/g, "")), "Phone number");
  const orgs = (me.experience ?? []).map((e) => norm(e.org));
  const company = norm(document.title).split(/[|–-]/)[0] ?? "";
  push(rep, "previousWorker", wdRadio("previousWorker", orgs.some((o) => o && company.includes(o)) ? "Yes" : "No"), "Previously worked here");
  return rep;
}

/** My Experience page: work rows, education rows, skills, websites, resume. */
export async function wdFillExperience(me: Me, files: { kind: string; file: File }[]): Promise<WdReport> {
  const rep: WdReport = []; const f = me.fields as Values;
  const jobs: MeExperience[] = (me.experience ?? []).filter((e) => e.kind === "job" || e.kind === "internship").slice(0, 5);
  if (jobs.length) {
    const rows = await wdEnsureRows("workExperienceSection", "workExperience", jobs.length);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!, j = jobs[i]!;
      let ok: Tri = wdText("jobTitle", j.title, r); const co = wdText("company", j.org, r); ok = ok === null && co === null ? null : !!ok || !!co;
      wdText("location", (f.city as string) ?? "", r);
      if (j.current) wdCheckbox("currentlyWorkHere", true, r);
      wdDate("startDate", j.start, r); if (!j.current) wdDate("endDate", j.end, r);
      wdText("description", j.bullets.map((b) => `• ${b}`).join("\n"), r);
      push(rep, `work-${i + 1}`, ok, `Work experience ${i + 1}: ${j.title}`);
    }
  }
  const edus: MeEducation[] = (me.education ?? []).slice(0, 3);
  if (edus.length) {
    const rows = await wdEnsureRows("educationSection", "education", edus.length);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!, e = edus[i]!;
      const s1 = await wdSearch("schoolItem", e.school, r); const school: Tri = s1 === true ? true : s1 === null ? (await wdSearch("school", e.school, r) === true ? true : wdText("schoolName", e.school, r)) : (wdText("schoolName", e.school, r) === true);
      for (const g of degreeGuesses(e.degreeName, e.degree)) if (await wdListbox("degree", g, r)) break;
      if (e.field) { const f1 = await wdSearch("field-of-study", e.field, r, 5000); if (f1 === null) await wdSearch("fieldOfStudy", e.field, r, 5000); }
      if (e.gpa != null) { if (wdText("gradeAverage", String(e.gpa), r) === null) wdText("gpa", String(e.gpa), r); }
      if (e.startYear) wdDate("firstYearAttended", String(e.startYear), r);
      if (e.gradYear) wdDate("lastYearAttended", String(e.gradYear), r);
      push(rep, `edu-${i + 1}`, school, `Education ${i + 1}: ${e.school}`);
    }
  }
  const skillsBox = byField("skillsPrompt") ?? byAuto("skillsSection");
  if (skillsBox) { let n = 0; for (const s of me.skills.slice(0, 12)) { if ((await wdSearch(byField("skillsPrompt") ? "skillsPrompt" : "skillsSection", s, document, 3000)) === true) n++; } push(rep, "skills", n > 0, `Skills (${n} added)`); }
  const sites = [f.linkedin, f.github, f.portfolio].filter(Boolean) as string[];
  if (sites.length && byAuto("websiteSection")) {
    const rows = await wdEnsureRows("websiteSection", "websitePanelSet", sites.length);
    rows.forEach((r, i) => { const inp = inputOf(r); if (inp) setValue(inp, sites[i]!); });
    push(rep, "websites", rows.length > 0, "Websites");
  }
  if (f.linkedin) push(rep, "linkedin", wdText("linkedinQuestion", f.linkedin as string), "LinkedIn");
  if (byAuto("skillsSection") === null && byAuto("websiteSection") === null && !jobs.length && !edus.length) return rep;
  const resume = files.find((x) => x.kind === "resume");
  if (resume) { const input = document.querySelector<HTMLInputElement>('input[data-automation-id="file-upload-input-ref"], input[type="file"]'); if (input) { try { const dt = new DataTransfer(); dt.items.add(resume.file); input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true })); push(rep, "resume", true, `Resume: ${resume.file.name}`); } catch { push(rep, "resume", false, "Resume"); } } }
  return rep;
}

/** Voluntary disclosures: saved answers only; nothing is guessed and nothing leaves the browser. */
export async function wdFillDisclosures(saved: Record<string, unknown>): Promise<WdReport> {
  const rep: WdReport = [];
  const get = (...keys: string[]) => keys.map((k) => saved[k]).find((v) => typeof v === "string") as string | undefined;
  push(rep, "gender", await wdListbox("gender", get("gender", "what is your gender", "gender identity")), "Gender");
  push(rep, "ethnicity", await wdListbox("ethnicityDropdown", get("race", "ethnicity", "race ethnicity", "please identify your race", "hispanic latino")), "Race / ethnicity");
  push(rep, "hispanic", await wdListbox("hispanicOrLatino", get("are you hispanic latino", "hispanic latino")), "Hispanic or Latino");
  push(rep, "veteran", await wdListbox("veteranStatus", get("veteran status", "veteran")), "Veteran status");
  return rep;
}

/** Workday's own Next button. Rails never clicks Submit; "Save and Continue" is navigation the user asks for. */
export function wdNextButton(): HTMLElement | null {
  const byId = document.querySelector<HTMLElement>('button[data-automation-id="bottom-navigation-next-button"], button[data-automation-id="pageFooterNextButton"], button[data-automation-id="wd-CommandButton_uic_nextButton"]');
  if (byId) return byId;
  const buttons = [...document.querySelectorAll<HTMLElement>("button")].filter((b) => !b.closest("#rails-drawer-host") && !(b as HTMLButtonElement).disabled);
  return buttons.find((b) => /^(save and continue|continue|next|save & continue)$/i.test(clean(b.textContent))) ?? null;
}
/** True when this page's forward button would submit the application rather than advance a step. */
export const wdIsSubmit = (b: HTMLElement | null) => !!b && /submit/i.test(clean(b.textContent));

export function wdErrors(): string[] {
  return [...document.querySelectorAll('[data-automation-id="errorMessage"], [data-automation-id="fieldErrorMessage"], [role="alert"]')].map((e) => clean(e.textContent)).filter((t) => t && t.length < 200);
}

/** Watch the SPA for a step change (URL or progress bar) and call back once per new step. */
export function watchSteps(cb: (step: WdStep) => void): () => void {
  let last = `${location.href}|${wdStep().key}`;
  const check = () => { const now = `${location.href}|${wdStep().key}`; if (now !== last) { last = now; cb(wdStep()); } };
  const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(check, 400); }); let t: ReturnType<typeof setTimeout>;
  mo.observe(document.body, { childList: true, subtree: true });
  const iv = setInterval(check, 1500);
  return () => { mo.disconnect(); clearInterval(iv); };
}
export { mouse };
