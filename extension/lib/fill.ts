/**
 * Field mapping engine. DOM only (no chrome APIs) so it runs in vitest/jsdom.
 * Order per field: learned selector -> ATS selector -> autocomplete attr -> name/id -> label text -> placeholder.
 * Handles native inputs/selects, radios, and combobox widgets (react-select on Greenhouse: type, wait for the menu, click the option).
 * Never touches submit buttons, file inputs, consent checkboxes, or EEO/self-identification questions.
 */
export type FieldKey = "firstName" | "lastName" | "fullName" | "preferredName" | "email" | "phone" | "phoneCountry" | "linkedin" | "github" | "portfolio" | "street" | "city" | "state" | "zip" | "country" | "residenceCountry" | "residenceState" | "school" | "degree" | "major" | "disciplines" | "startYear" | "gradYear" | "gradDate" | "gradMonth" | "gpa" | "workAuthorized" | "needsSponsorship";
export type Values = Record<string, string | boolean | string[] | null | undefined>;
export type FillResult = { key: FieldKey; selector: string | null; strategy: string; success: boolean };
export type FillReport = { results: FillResult[]; leftForYou: string[] };

type Rule = { key: FieldKey; from?: string; autocomplete?: string[]; names: RegExp; label: RegExp; placeholder?: RegExp; select?: boolean; multi?: boolean; not?: RegExp };

/** `from` = which value key to read when the field key is derived (residenceState reads stateName). */
const RULES: Rule[] = [
  { key: "firstName", autocomplete: ["given-name"], names: /first[_-]?name|fname|givenname|^first$/i, label: /^first name\*?$|^given name|^first\*?$/i, not: /preferred/i },
  { key: "lastName", autocomplete: ["family-name"], names: /last[_-]?name|lname|surname|familyname|^last$/i, label: /^last name|^surname|^family name|^last\*?$/i },
  { key: "fullName", autocomplete: ["name"], names: /^(full[_-]?name|name|applicant[_-]?name|your[_-]?name)$/i, label: /^(full )?name\*?$|^your name/i },
  { key: "preferredName", names: /preferred[_-]?(first[_-]?)?name|nickname/i, label: /preferred (first )?name|nickname/i },
  { key: "email", autocomplete: ["email"], names: /e-?mail/i, label: /e-?mail/i, placeholder: /e-?mail/i, not: /confirm|re-?enter/i },
  { key: "phone", autocomplete: ["tel", "tel-national"], names: /phone|mobile|^tel\b/i, label: /^phone|mobile|telephone/i, placeholder: /phone|\(\d{3}\)/i, not: /country|type|extension/i },
  { key: "phoneCountry", names: /phone[_-]?country|country[_-]?code|dial/i, label: /^country\*?$|country code|phone country/i, select: true },
  { key: "linkedin", names: /linkedin/i, label: /linkedin/i, placeholder: /linkedin/i },
  { key: "github", names: /github/i, label: /github/i, placeholder: /github/i },
  { key: "portfolio", autocomplete: ["url"], names: /portfolio|website|personal[_-]?site|^url$/i, label: /portfolio|website|personal site/i },
  { key: "street", autocomplete: ["street-address", "address-line1"], names: /street|address[_-]?(line)?1|addressline1|^address$/i, label: /^street|address line 1|^address\*?$/i },
  { key: "city", autocomplete: ["address-level2"], names: /city|locality/i, label: /^city/i },
  { key: "state", autocomplete: ["address-level1"], names: /state|region|province/i, label: /^state|province|region/i, not: /reside|residence|live/i },
  { key: "zip", autocomplete: ["postal-code"], names: /zip|postal/i, label: /zip|postal/i },
  { key: "country", autocomplete: ["country", "country-name"], names: /country/i, label: /^country/i, select: true, not: /reside|residence|live|phone|dial/i },
  { key: "residenceCountry", from: "country", names: /reside|residence/i, label: /country (do you|you) (currently )?(reside|live)|country of residence/i, select: true },
  { key: "residenceState", from: "stateName", names: /reside.*state|state.*reside/i, label: /state (do you|you) (currently )?(reside|live)|which (us )?state/i, select: true },
  { key: "school", names: /school|university|college|institution/i, label: /^school|university|college|institution|re-?confirm the university/i },
  { key: "degree", from: "degreeName", names: /degree/i, label: /^degree/i },
  { key: "major", names: /major|field[_-]?of[_-]?study|discipline/i, label: /^major|field of study|^discipline/i, not: /undergrad|multiple|select all/i },
  { key: "disciplines", names: /discipline/i, label: /undergrad discipline|discipline\(s\)/i, select: true, multi: true },
  { key: "startYear", names: /start[_-]?(date[_-]?)?year|start[_-]?year/i, label: /start (date )?year/i },
  { key: "gradYear", names: /end[_-]?(date[_-]?)?year|grad(uation)?[_-]?year|end[_-]?year/i, label: /end (date )?year|graduation year/i },
  { key: "gradDate", from: "gradDate", names: /grad(uation)?[_-]?date/i, label: /expected graduation date|graduation date/i, select: true },
  { key: "gradMonth", names: /end[_-]?(date[_-]?)?month|grad(uation)?[_-]?month/i, label: /end (date )?month|graduation month/i, select: true },
  { key: "gpa", names: /gpa/i, label: /gpa|grade point/i },
  { key: "workAuthorized", names: /authori[sz]ed|work[_-]?auth|eligib/i, label: /legally authori[sz]ed|authori[sz]ed to work|eligible to work/i, select: true },
  { key: "needsSponsorship", names: /sponsor/i, label: /sponsorship|require .*visa|need .*visa/i, select: true },
];

/** Questions the extension deliberately leaves alone. Reported back so the user knows what to do by hand. */
export const LEAVE_ALONE = /pronoun|gender|hispanic|latino|race|ethnicit|veteran|disabilit|self-identif|terms|privacy|consent|agree|how did you hear|referr|salary|compensation|cover letter|resume|cv\b|attach/i;

export const ATS_SELECTORS: Record<string, Partial<Record<FieldKey, string[]>>> = {
  greenhouse: { firstName: ["#first_name"], lastName: ["#last_name"], email: ["#email"], phone: ["#phone"], linkedin: ['input[name*="linkedin" i]', '[id*="linkedin" i]'], github: ['input[name*="github" i]'], portfolio: ['input[name*="website" i]'] },
  lever: { fullName: ['input[name="name"]'], email: ['input[name="email"]'], phone: ['input[name="phone"]'], linkedin: ['input[name="urls[LinkedIn]"]'], github: ['input[name="urls[GitHub]"]'], portfolio: ['input[name="urls[Portfolio]"]', 'input[name="urls[Other]"]'], school: ['input[name="org"]'] },
  workday: { firstName: ['[data-automation-id="legalNameSection_firstName"]'], lastName: ['[data-automation-id="legalNameSection_lastName"]'], email: ['[data-automation-id="email"]'], phone: ['[data-automation-id="phone-number"]'], street: ['[data-automation-id="addressSection_addressLine1"]'], city: ['[data-automation-id="addressSection_city"]'], zip: ['[data-automation-id="addressSection_postalCode"]'], linkedin: ['[data-automation-id="linkedinQuestion"] input', 'input[data-automation-id*="linkedin" i]'] },
  icims: { firstName: ['input[id*="FirstName" i]', 'input[name*="FirstName" i]'], lastName: ['input[id*="LastName" i]', 'input[name*="LastName" i]'], email: ['input[id*="Email" i]', 'input[type="email"]'], phone: ['input[id*="Phone" i]', 'input[type="tel"]'], city: ['input[id*="City" i]'], zip: ['input[id*="Zip" i]', 'input[id*="Postal" i]'], linkedin: ['input[id*="LinkedIn" i]'] },
  ashby: { fullName: ['input[name="_systemfield_name"]', 'input[placeholder*="name" i]'], email: ['input[name="_systemfield_email"]', 'input[type="email"]'], phone: ['input[type="tel"]'], linkedin: ['input[placeholder*="linkedin" i]'], github: ['input[placeholder*="github" i]'] },
  smartrecruiters: { firstName: ['input[name="firstName"]'], lastName: ['input[name="lastName"]'], email: ['input[name="email"]'], phone: ['input[name="phoneNumber"]'], city: ['input[name="location"]'] },
  workable: { firstName: ['input[name="firstname"]', '#firstname'], lastName: ['input[name="lastname"]', '#lastname'], email: ['input[name="email"]'], phone: ['input[name="phone"]'], linkedin: ['input[name*="linkedin" i]'], github: ['input[name*="github" i]'] },
};

export function atsOf(host: string): string {
  if (/greenhouse\.io$/.test(host)) return "greenhouse";
  if (/lever\.co$/.test(host)) return "lever";
  if (/myworkdayjobs\.com$|myworkday\.com$/.test(host)) return "workday";
  if (/icims\.com$/.test(host)) return "icims";
  if (/ashbyhq\.com$/.test(host)) return "ashby";
  if (/smartrecruiters\.com$/.test(host)) return "smartrecruiters";
  if (/workable\.com$/.test(host)) return "workable";
  return "generic";
}

export type El = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
const cssEscape = (s: string) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s.replace(/([^a-zA-Z0-9_-])/g, "\\$1"));
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").replace(/\*/g, "").trim();

export function isFillable(el: Element | null): el is El {
  if (!el) return false;
  if (el instanceof HTMLInputElement) return !["hidden", "submit", "button", "file", "image", "reset", "password"].includes(el.type) && !el.disabled && !el.readOnly;
  return (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) && !el.disabled;
}
export const isCombobox = (el: El) => el instanceof HTMLInputElement && (el.getAttribute("role") === "combobox" || el.getAttribute("aria-autocomplete") === "list" || /select__input|react-select/i.test(el.className + " " + (el.parentElement?.className ?? "")));

export function labelTextFor(el: Element, root: Document | ShadowRoot): string {
  const parts: string[] = [];
  const id = el.getAttribute("id");
  if (id) for (const l of root.querySelectorAll(`label[for="${cssEscape(id)}"]`)) parts.push(l.textContent ?? "");
  const wrap = el.closest("label"); if (wrap) parts.push(wrap.textContent ?? "");
  const aria = el.getAttribute("aria-label"); if (aria) parts.push(aria);
  const by = el.getAttribute("aria-labelledby"); if (by) for (const i of by.split(/\s+/)) parts.push((root as Document).getElementById?.(i)?.textContent ?? "");
  if (parts.join("").trim() === "") {
    // widgets without a real label: nearest label-like text in the enclosing block
    const block = el.closest("div, fieldset, li, section");
    const lab = block?.querySelector("label, legend, [class*='label' i], [id$='-label']");
    if (lab) parts.push(lab.textContent ?? "");
  }
  // the same text often arrives twice (label[for] + aria-label): keep each distinct piece once
  const seen = new Set<string>(); const uniq: string[] = [];
  for (const x of parts.map((t) => clean(t)).filter(Boolean)) { const k = x.toLowerCase(); if (!seen.has(k) && !uniq.some((u) => u.toLowerCase().includes(k))) { seen.add(k); uniq.push(x); } }
  return clean(uniq.join(" "));
}

/** Set a value the way a user would, so React/Vue/Angular controlled inputs notice. */
export function setValue(el: El, value: string | boolean): boolean {
  if (el instanceof HTMLSelectElement) {
    const want = String(value).toLowerCase();
    const opt = [...el.options].find((o) => o.value.toLowerCase() === want || o.text.trim().toLowerCase() === want)
      ?? [...el.options].find((o) => o.text.trim().toLowerCase().startsWith(want) || (want.length > 3 && o.text.toLowerCase().includes(want)));
    if (!opt) return false;
    el.value = opt.value; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    if (typeof value !== "boolean") return false;
    if (el.checked !== value) el.click();
    return el.checked === value;
  }
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  el.focus();
  if (setter) setter.call(el, String(value)); else el.value = String(value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
  return el.value === String(value);
}

export const mouse = (type: string, t: Element) => t.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }));
export const clickLike = (t: Element) => { mouse("mousedown", t); mouse("mouseup", t); mouse("click", t); };
export const controlOf = (input: HTMLInputElement): Element => input.closest(".select__control, [class*='__control' i], [class*='-control' i]") ?? input.closest("[class*='select' i]:not([class*='input' i])") ?? input.parentElement ?? input;
/** The container that holds both the control and the menu: react-select's outer div. */
export const containerOf = (input: HTMLInputElement): Element => input.closest(".select__container, [class*='__container' i]:not([class*='input' i]):not([class*='value' i])") ?? controlOf(input).parentElement ?? controlOf(input);
export function listboxFor(input: HTMLInputElement, root: Document | ShadowRoot): HTMLElement[] {
  const id = input.getAttribute("aria-controls") ?? input.getAttribute("aria-owns");
  const lb = id ? (root as Document).getElementById?.(id) ?? document.getElementById(id) : null;
  if (lb) return [...lb.querySelectorAll<HTMLElement>('[role="option"]')];
  const menu = containerOf(input).querySelector(".select__menu, [class*='menu' i]");
  if (menu) return [...menu.querySelectorAll<HTMLElement>('[role="option"], .select__option')];
  return [...root.querySelectorAll<HTMLElement>('[role="option"]')].filter((o) => !/iti__/.test(o.className)); // never the phone flag list
}
export const shownValue = (input: HTMLInputElement): string => {
  let el: Element | null = input.parentElement; const sel = ".select__single-value, .select__multi-value, [class*='single-value' i], [class*='multi-value' i]";
  for (let i = 0; el && i < 6; i++, el = el.parentElement) { const v = el.querySelector(sel); if (v) return clean(v.textContent); }
  return "";
};
export function bestOption(options: HTMLElement[], want: string): HTMLElement | null {
  const w = want.toLowerCase().trim(); const texts = options.map((o) => clean(o.textContent).toLowerCase());
  let idx = texts.findIndex((t) => t === w);
  if (idx < 0 && /^(yes|no)$/.test(w)) idx = texts.findIndex((t) => new RegExp(`^${w}\\b`).test(t));
  if (idx < 0) idx = texts.findIndex((t) => t.startsWith(w));
  if (idx < 0 && w.length > 2) idx = texts.findIndex((t) => t.includes(w));
  if (idx < 0 && w.includes(" ")) { const words = w.split(/\s+/).filter((x) => x.length > 2); idx = texts.findIndex((t) => words.every((x) => t.includes(x))); }
  return idx >= 0 ? options[idx]! : null;
}

/** react-select and friends. Returns true when the control shows the chosen value. Bounded to ~6 s so a slow server-side search cannot hang the fill. */
export async function pickCombobox(input: HTMLInputElement, want: string, root: Document | ShadowRoot, opts: { type?: boolean; budgetMs?: number } = {}): Promise<boolean> {
  const ctl = controlOf(input); const t0 = Date.now(); const budget = opts.budgetMs ?? 6000;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  input.focus(); clickLike(ctl);
  await sleep(120);
  let options = listboxFor(input, root);
  // static lists: pick straight from what opened; typing first narrows lists that are searchable
  let hit = options.length ? bestOption(options, want) : null;
  if (!hit) {
    const typed = opts.type === false ? "" : want;
    if (typed) { if (setter) setter.call(input, typed); else input.value = typed; input.dispatchEvent(new Event("input", { bubbles: true })); }
    while (Date.now() - t0 < budget) {
      await sleep(250);
      options = listboxFor(input, root).filter((o) => !/^(loading|no options)/i.test(clean(o.textContent)));
      if (options.length) { hit = bestOption(options, want); if (hit) break; }
      const menuText = clean(containerOf(input).querySelector(".select__menu")?.textContent);
      if (/no options/i.test(menuText)) break;
    }
  }
  if (!hit) { input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); mouse("mousedown", document.body); return false; }
  clickLike(hit);
  await sleep(120);
  const shown = shownValue(input);
  return !!shown || input.getAttribute("aria-expanded") === "false" || !listboxFor(input, root).length; // menu closed after the click = the pick registered
}

/** Checkbox groups (Greenhouse multi-select questions): tick the boxes whose label matches each wanted value. */
function tickBoxes(root: Document | ShadowRoot, wanted: string[]): { el: HTMLInputElement; ok: boolean }[] {
  const out: { el: HTMLInputElement; ok: boolean }[] = [];
  const boxes = [...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  for (const w of wanted) {
    const lw = w.toLowerCase();
    const box = boxes.find((b) => clean(labelTextFor(b, root)).toLowerCase() === lw) ?? boxes.find((b) => clean(labelTextFor(b, root)).toLowerCase().startsWith(lw));
    if (box && !box.checked) { box.click(); out.push({ el: box, ok: box.checked }); }
    else if (box) out.push({ el: box, ok: true });
  }
  return out;
}

export function cssPath(el: Element): string | null {
  const id = el.getAttribute("id"); if (id) return `#${cssEscape(id)}`;
  const name = el.getAttribute("name"); if (name) return `${el.tagName.toLowerCase()}[name="${name.replace(/"/g, '\\"')}"]`;
  const auto = el.getAttribute("data-automation-id"); if (auto) return `[data-automation-id="${auto}"]`;
  return null;
}

const asText = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "boolean" ? (v ? "Yes" : "No") : null);

export async function fillForm(root: Document | ShadowRoot, values: Values, opts: { ats: string; learned?: Record<string, string[]> }): Promise<FillReport> {
  const results: FillResult[] = [];
  const used = new Set<Element>();
  const all = [...root.querySelectorAll<El>("input, textarea, select")].filter(isFillable);
  const valueFor = (rule: Rule) => values[rule.from ?? rule.key];

  const apply = async (el: El, rule: Rule, strategy: string): Promise<boolean> => {
    if (used.has(el)) return false;
    const v = valueFor(rule); if (v == null || v === "" || (Array.isArray(v) && !v.length)) return false;
    used.add(el);
    const lab = labelTextFor(el, root);
    if (rule.not && rule.not.test(lab)) { used.delete(el); return false; }
    // multi-select (disciplines): pick each value
    if (Array.isArray(v)) {
      if (!isCombobox(el)) { const ok = el instanceof HTMLSelectElement ? v.map((x) => setValue(el, x)).some(Boolean) : false; results.push({ key: rule.key, selector: cssPath(el), strategy, success: ok }); return true; }
      let any = false; for (const x of v) any = (await pickCombobox(el as HTMLInputElement, x, root, { budgetMs: 3000 })) || any;
      results.push({ key: rule.key, selector: cssPath(el), strategy, success: any }); return true;
    }
    const text = asText(v)!;
    if (isCombobox(el)) {
      const ok = await pickCombobox(el as HTMLInputElement, text, root, { type: rule.key !== "workAuthorized" && rule.key !== "needsSponsorship", budgetMs: rule.key === "school" ? 6000 : 4000 });
      results.push({ key: rule.key, selector: cssPath(el), strategy: `${strategy}:combo`, success: ok }); return true;
    }
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) { used.delete(el); return false; }
    if (el instanceof HTMLSelectElement) { const ok = setValue(el, text); results.push({ key: rule.key, selector: cssPath(el), strategy, success: ok }); return true; }
    if (el.value && el.value.trim() && el.value.trim() !== text) { results.push({ key: rule.key, selector: cssPath(el), strategy: `${strategy}:kept`, success: true }); return true; } // never overwrite what the user typed
    const ok = setValue(el, text);
    results.push({ key: rule.key, selector: cssPath(el), strategy, success: ok });
    return true;
  };

  const yesNoRadios = (rule: Rule, value: boolean): FillResult | null => {
    const want = value ? /^(yes|y|true)$/i : /^(no|n|false)$/i;
    for (const group of root.querySelectorAll("fieldset, div, li")) {
      const text = clean(group.querySelector("legend, label, p, span")?.textContent);
      if (!rule.label.test(text)) continue;
      const radios = [...group.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
      const hit = radios.find((r) => want.test(labelTextFor(r, root)) || want.test(r.value));
      if (hit) { const ok = setValue(hit, true); return { key: rule.key, selector: cssPath(hit), strategy: "label", success: ok }; }
    }
    return null;
  };

  for (const rule of RULES) {
    const v = valueFor(rule); if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    if (typeof v === "boolean") { const r = yesNoRadios(rule, v); if (r) { results.push(r); continue; } }
    if (Array.isArray(v) && rule.multi) {
      // checkbox groups first (Greenhouse renders multi-select questions as checkboxes)
      const ticked = tickBoxes(root, v);
      if (ticked.length) { for (const t of ticked) used.add(t.el); results.push({ key: rule.key, selector: cssPath(ticked[0]!.el), strategy: "checkbox", success: ticked.some((t) => t.ok) }); continue; }
    }
    let done = false;
    for (const sel of opts.learned?.[rule.key] ?? []) { const el = root.querySelector(sel); if (isFillable(el) && (await apply(el, rule, "learned"))) { done = true; break; } }
    if (done) continue;
    for (const sel of ATS_SELECTORS[opts.ats]?.[rule.key] ?? []) { const el = root.querySelector(sel); if (isFillable(el) && (await apply(el, rule, "ats"))) { done = true; break; } }
    if (done) continue;
    if (rule.autocomplete) { const el = all.find((e) => !used.has(e) && rule.autocomplete!.includes((e.getAttribute("autocomplete") ?? "").toLowerCase())); if (el && (await apply(el, rule, "autocomplete"))) continue; }
    const byName = all.find((e) => !used.has(e) && (rule.names.test(e.getAttribute("name") ?? "") || rule.names.test(e.id) || rule.names.test(e.getAttribute("data-automation-id") ?? "")) && !(rule.not && rule.not.test(labelTextFor(e, root))));
    if (byName && (await apply(byName, rule, "name"))) continue;
    const byLabel = all.find((e) => !used.has(e) && rule.label.test(labelTextFor(e, root)) && !(rule.not && rule.not.test(labelTextFor(e, root))) && (!rule.select || e instanceof HTMLSelectElement || isCombobox(e)));
    if (byLabel && (await apply(byLabel, rule, "label"))) continue;
    if (rule.placeholder) { const byPh = all.find((e) => !used.has(e) && rule.placeholder!.test(e.getAttribute("placeholder") ?? "")); if (byPh && (await apply(byPh, rule, "placeholder"))) continue; }
  }

  // What we left for the human: required-looking questions we did not touch.
  const leftForYou: string[] = [];
  for (const e of all) {
    if (used.has(e)) continue;
    const lab = labelTextFor(e, root); if (!lab || lab.length > 140) continue;
    const required = e.required || e.getAttribute("aria-required") === "true" || /\*\s*$/.test(e.closest("div,fieldset")?.querySelector("label")?.textContent ?? "");
    if (required || LEAVE_ALONE.test(lab)) if (!leftForYou.includes(lab)) leftForYou.push(lab);
  }
  for (const f of root.querySelectorAll<HTMLInputElement>('input[type="file"]')) { const lab = labelTextFor(f, root) || "Resume / attachment"; if (!leftForYou.includes(lab)) leftForYou.unshift(lab); }
  return { results, leftForYou: leftForYou.slice(0, 12) };
}

/** Attach a file to the matching file input (resume or cover letter). Browsers allow this only via DataTransfer; sites see a normal change event. */
export function attachFile(root: Document | ShadowRoot, kind: "resume" | "letter", file: File): { selector: string | null; success: boolean } {
  const inputs = [...root.querySelectorAll<HTMLInputElement>('input[type="file"]')].filter((i) => !i.disabled);
  const want = kind === "resume" ? /resume|cv\b|curriculum/i : /cover|letter/i;
  const avoid = kind === "resume" ? /cover|letter|transcript|portfolio|photo/i : /resume|cv\b|transcript|photo/i;
  const scored = inputs.map((i) => { const lab = `${labelTextFor(i, root)} ${i.name} ${i.id} ${i.getAttribute("aria-label") ?? ""} ${i.closest("div,fieldset,section")?.textContent?.slice(0, 200) ?? ""}`; return { i, hit: want.test(lab) && !avoid.test(lab.replace(want, "")), lab }; });
  const target = scored.find((s) => s.hit)?.i ?? (kind === "resume" && inputs.length === 1 ? inputs[0] : undefined);
  if (!target) return { selector: null, success: false };
  try {
    if (typeof DataTransfer !== "undefined") { const dt = new DataTransfer(); dt.items.add(file); target.files = dt.files; }
    else { Object.defineProperty(target, "files", { configurable: true, value: Object.assign([file], { item: (i: number) => (i === 0 ? file : null) }) }); } // jsdom / old engines
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    return { selector: target.id ? `#${cssEscape(target.id)}` : target.name ? `input[name="${target.name}"]` : null, success: (target.files?.length ?? 0) > 0 };
  } catch { return { selector: null, success: false }; }
}
