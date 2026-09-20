/**
 * Field mapping engine. Pure DOM logic, no chrome APIs, so it runs in vitest with jsdom.
 * Strategy order per field: learned selector -> ATS-specific selector -> autocomplete attr -> name/id -> label text -> placeholder.
 * Never touches submit buttons. Never sets a file input. React/Angular-safe value setting.
 */
export type FieldKey = "firstName" | "lastName" | "fullName" | "email" | "phone" | "linkedin" | "github" | "portfolio" | "city" | "state" | "country" | "school" | "degree" | "major" | "gradYear" | "gpa" | "workAuthorized" | "needsSponsorship";
export type Values = Partial<Record<FieldKey, string | boolean | null>>;
export type FillResult = { key: FieldKey; selector: string | null; strategy: string; success: boolean };

type Rule = { key: FieldKey; autocomplete?: string[]; names: RegExp; label: RegExp; placeholder?: RegExp };

const RULES: Rule[] = [
  { key: "firstName", autocomplete: ["given-name"], names: /first[_-]?name|fname|givenname|first$/i, label: /^first name|given name|first$/i },
  { key: "lastName", autocomplete: ["family-name"], names: /last[_-]?name|lname|surname|familyname|last$/i, label: /^last name|surname|family name|last$/i },
  { key: "fullName", autocomplete: ["name"], names: /^(full[_-]?name|name|applicant[_-]?name|your[_-]?name)$/i, label: /^(full )?name$|^your name$/i },
  { key: "email", autocomplete: ["email"], names: /e-?mail/i, label: /e-?mail/i, placeholder: /e-?mail/i },
  { key: "phone", autocomplete: ["tel", "tel-national"], names: /phone|mobile|tel\b/i, label: /phone|mobile/i, placeholder: /phone|\(\d{3}\)/i },
  { key: "linkedin", names: /linkedin/i, label: /linkedin/i, placeholder: /linkedin/i },
  { key: "github", names: /github/i, label: /github/i, placeholder: /github/i },
  { key: "portfolio", autocomplete: ["url"], names: /portfolio|website|personal[_-]?site|url$/i, label: /portfolio|website|personal site/i },
  { key: "city", autocomplete: ["address-level2"], names: /city|locality/i, label: /^city/i },
  { key: "state", autocomplete: ["address-level1"], names: /state|region|province/i, label: /^state|province|region/i },
  { key: "country", autocomplete: ["country", "country-name"], names: /country/i, label: /^country/i },
  { key: "school", names: /school|university|college|institution|education/i, label: /school|university|college|institution/i },
  { key: "degree", names: /degree/i, label: /degree/i },
  { key: "major", names: /major|field[_-]?of[_-]?study|discipline/i, label: /major|field of study|discipline/i },
  { key: "gradYear", names: /grad(uation)?[_-]?(year|date)|end[_-]?date|year/i, label: /graduation|grad (year|date)|expected/i },
  { key: "gpa", names: /gpa/i, label: /gpa|grade point/i },
  { key: "workAuthorized", names: /authori[sz]ed|work[_-]?auth|eligib/i, label: /legally authori[sz]ed|authori[sz]ed to work|eligible to work/i },
  { key: "needsSponsorship", names: /sponsor|visa/i, label: /sponsorship|require .*visa|need .*visa/i },
];

/** Selectors that are known per ATS (fast path, high precision). */
export const ATS_SELECTORS: Record<string, Partial<Record<FieldKey, string[]>>> = {
  greenhouse: { firstName: ["#first_name"], lastName: ["#last_name"], email: ["#email"], phone: ["#phone"], linkedin: ['input[name*="linkedin" i]', '[id*="linkedin" i]'], github: ['input[name*="github" i]'], portfolio: ['input[name*="website" i]'] },
  lever: { fullName: ['input[name="name"]'], email: ['input[name="email"]'], phone: ['input[name="phone"]'], linkedin: ['input[name="urls[LinkedIn]"]'], github: ['input[name="urls[GitHub]"]'], portfolio: ['input[name="urls[Portfolio]"]', 'input[name="urls[Other]"]'], school: ['input[name="org"]'] },
  workday: { firstName: ['[data-automation-id="legalNameSection_firstName"]'], lastName: ['[data-automation-id="legalNameSection_lastName"]'], email: ['[data-automation-id="email"]'], phone: ['[data-automation-id="phone-number"]'], city: ['[data-automation-id="addressSection_city"]'], state: ['[data-automation-id="addressSection_countryRegion"]'], linkedin: ['[data-automation-id="linkedinQuestion"] input', 'input[data-automation-id*="linkedin" i]'] },
  icims: { firstName: ['input[id*="FirstName" i]', 'input[name*="FirstName" i]'], lastName: ['input[id*="LastName" i]', 'input[name*="LastName" i]'], email: ['input[id*="Email" i]', 'input[type="email"]'], phone: ['input[id*="Phone" i]', 'input[type="tel"]'], city: ['input[id*="City" i]'], linkedin: ['input[id*="LinkedIn" i]'] },
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

type El = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
const cssEscape = (s: string) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s.replace(/([^a-zA-Z0-9_-])/g, "\\$1"));

function isFillable(el: Element | null): el is El {
  if (!el) return false;
  if (el instanceof HTMLInputElement) return !["hidden", "submit", "button", "file", "image", "reset", "password"].includes(el.type) && !el.disabled && !el.readOnly;
  return (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) && !el.disabled;
}

function labelTextFor(el: El, root: Document | ShadowRoot): string {
  const parts: string[] = [];
  if (el.id) for (const l of root.querySelectorAll(`label[for="${cssEscape(el.id)}"]`)) parts.push(l.textContent ?? "");
  const wrap = el.closest("label"); if (wrap) parts.push(wrap.textContent ?? "");
  const aria = el.getAttribute("aria-label"); if (aria) parts.push(aria);
  const by = el.getAttribute("aria-labelledby"); if (by) for (const id of by.split(/\s+/)) parts.push(root.getElementById?.(id)?.textContent ?? "");
  // Workday / custom widgets: nearest preceding label-like element
  const prev = el.closest("div, fieldset, li")?.querySelector("label, legend, [class*='label' i]");
  if (prev) parts.push(prev.textContent ?? "");
  return parts.join(" ").replace(/\s+/g, " ").trim();
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

/** Yes/No questions (work authorization, sponsorship) rendered as radios or selects. */
function fillYesNo(root: Document | ShadowRoot, rule: Rule, value: boolean): FillResult | null {
  const want = value ? /^(yes|y|true)$/i : /^(no|n|false)$/i;
  for (const group of root.querySelectorAll("fieldset, div, li")) {
    const text = (group.querySelector("legend, label, p, span")?.textContent ?? "").replace(/\s+/g, " ");
    if (!rule.label.test(text)) continue;
    const radios = [...group.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    const hit = radios.find((r) => want.test(labelTextFor(r, root).trim()) || want.test(r.value));
    if (hit) { const ok = setValue(hit, true); return { key: rule.key, selector: hit.id ? `#${hit.id}` : null, strategy: "label", success: ok }; }
    const sel = group.querySelector<HTMLSelectElement>("select");
    if (sel) { const ok = setValue(sel, value ? "Yes" : "No"); return { key: rule.key, selector: sel.id ? `#${sel.id}` : null, strategy: "label", success: ok }; }
  }
  return null;
}

function cssPath(el: Element): string | null {
  if (el.id) return `#${cssEscape(el.id)}`;
  const name = el.getAttribute("name"); if (name) return `${el.tagName.toLowerCase()}[name="${name.replace(/"/g, '\\"')}"]`;
  const auto = el.getAttribute("data-automation-id"); if (auto) return `[data-automation-id="${auto}"]`;
  return null;
}

export function fillForm(root: Document | ShadowRoot, values: Values, opts: { ats: string; learned?: Record<string, string[]> }): FillResult[] {
  const results: FillResult[] = [];
  const used = new Set<Element>();
  const all = [...root.querySelectorAll<El>("input, textarea, select")].filter(isFillable);
  const tryEl = (el: El, rule: Rule, strategy: string): boolean => {
    if (used.has(el)) return false;
    const v = values[rule.key]; if (v == null || v === "") return false;
    if (typeof v === "boolean") return false;
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) return false;
    if (el.value && el.value.trim() && el.value.trim() !== String(v)) { used.add(el); results.push({ key: rule.key, selector: cssPath(el), strategy: `${strategy}:kept`, success: true }); return true; } // never overwrite what the user typed
    const ok = setValue(el, v);
    used.add(el); results.push({ key: rule.key, selector: cssPath(el), strategy, success: ok });
    return true;
  };
  for (const rule of RULES) {
    const v = values[rule.key]; if (v == null || v === "") continue;
    if (typeof v === "boolean") { const r = fillYesNo(root, rule, v); if (r) results.push(r); continue; }
    let done = false;
    for (const sel of opts.learned?.[rule.key] ?? []) { const el = root.querySelector(sel); if (isFillable(el) && tryEl(el, rule, "learned")) { done = true; break; } }
    if (done) continue;
    for (const sel of ATS_SELECTORS[opts.ats]?.[rule.key] ?? []) { const el = root.querySelector(sel); if (isFillable(el) && tryEl(el, rule, "ats")) { done = true; break; } }
    if (done) continue;
    if (rule.autocomplete) { const el = all.find((e) => rule.autocomplete!.includes((e.getAttribute("autocomplete") ?? "").toLowerCase())); if (el && tryEl(el, rule, "autocomplete")) continue; }
    const byName = all.find((e) => rule.names.test(e.getAttribute("name") ?? "") || rule.names.test(e.id) || rule.names.test(e.getAttribute("data-automation-id") ?? ""));
    if (byName && tryEl(byName, rule, "name")) continue;
    const byLabel = all.find((e) => rule.label.test(labelTextFor(e, root)));
    if (byLabel && tryEl(byLabel, rule, "label")) continue;
    if (rule.placeholder) { const byPh = all.find((e) => rule.placeholder!.test(e.getAttribute("placeholder") ?? "")); if (byPh && tryEl(byPh, rule, "placeholder")) continue; }
  }
  // fullName vs first/last: if a full-name field was filled, don't also report first/last as missing
  return results;
}
