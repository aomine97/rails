import { clean, isCombobox, isFillable, controlOf, shownValue, clickLike, mouse, listboxFor, bestOption, pickCombobox, sleep, labelTextFor, setValue, type El } from "./fill";

/** Everything the form asks, as the panel's checklist sees it. Built once per page; ids are stable data attributes. */
export type Kind = "text" | "textarea" | "number" | "date" | "select" | "combobox" | "radio" | "checkbox" | "checkboxes" | "file";
export type ScannedField = {
  id: string; label: string; kind: Kind; options?: string[]; required: boolean; filled: boolean; value?: string;
  /** EEO / pronouns / self-identification: never leaves the extension. */ sensitive: boolean;
  /** "If yes, …" / "If other, …": only relevant after another answer, shown as a dash. */ conditional: boolean;
  /** Server-side search box (school, company): options cannot be listed. */ searchable?: boolean;
  /** Legal checkbox (terms, consent, certify). */ legal?: boolean;
};

export const SENSITIVE = /pronoun|gender|hispanic|latino|\brace\b|ethnicit|veteran|disabilit|self-identif|sexual orientation|transgender/i;
const CONDITIONAL = /^\s*if\s+(yes|no|other|applicable|so|selected|you\s+(answered|selected))\b/i;
const LEGAL = /terms|privacy|consent|agree|acknowledg|certify|i confirm|i understand/i;
const PLACEHOLDER = /^(select|choose|please select|-+|\.\.\.|pick one)/i;

let seq = 0;
function mark(el: Element): string {
  let id = el.getAttribute("data-rails-f");
  if (!id) { id = String(++seq); el.setAttribute("data-rails-f", id); }
  return id;
}
const byId = (root: Document | ShadowRoot, id: string) => root.querySelector<HTMLElement>(`[data-rails-f="${id}"]`);

const isRequired = (el: Element, root: Document | ShadowRoot, label: string) =>
  (el as HTMLInputElement).required || el.getAttribute("aria-required") === "true" || /\*\s*$/.test(rawLabel(el, root)) || /\*\s*$/.test(label) || !!el.closest("[class*='required' i]")
  || /\*\s*$/.test((el.closest("fieldset, [role='group'], [role='radiogroup']")?.querySelector("legend, [id$='-label']")?.textContent ?? "").trim());
function rawLabel(el: Element, root: Document | ShadowRoot): string {
  const id = el.getAttribute("id"); const l = id ? root.querySelector(`label[for="${id.replace(/"/g, '\\"')}"]`) : el.closest("label");
  return (l?.textContent ?? "").replace(/\s+/g, " ").trim();
}
const groupLabel = (el: Element, root: Document | ShadowRoot): string => {
  const box = el.closest("fieldset, [role='group'], [role='radiogroup'], div");
  const lab = box?.querySelector("legend, [id$='-label'], label:not([for]), p, span, div");
  const t = clean(box?.querySelector("legend")?.textContent) || clean(el.closest("fieldset, [role='group'], [role='radiogroup']")?.getAttribute("aria-label")) || clean(lab?.textContent);
  return t.length > 200 ? "" : t;
};

/** Read the DOM into fields. Does not open anything; combobox options come from readComboOptions. */
export function scanFields(root: Document | ShadowRoot): ScannedField[] {
  const out: ScannedField[] = []; const seenGroups = new Set<string>();
  const nodes = [...root.querySelectorAll<HTMLElement>("input, textarea, select")];
  for (const el of nodes) {
    if (el instanceof HTMLInputElement && ["hidden", "submit", "button", "image", "reset", "password", "search"].includes(el.type)) continue;
    if ((el as HTMLInputElement).disabled) continue;
    if (/iti__|search-input|rails-/.test(el.className)) continue;
    const type = el instanceof HTMLInputElement ? el.type : el instanceof HTMLTextAreaElement ? "textarea" : "select";
    if (type === "file") {
      const label = labelTextFor(el, root) || "Attachment";
      out.push({ id: mark(el), label, kind: "file", required: isRequired(el, root, label), filled: ((el as HTMLInputElement).files?.length ?? 0) > 0, sensitive: false, conditional: false });
      continue;
    }
    if (type === "radio" || type === "checkbox") {
      const name = el.getAttribute("name") ?? ""; const key = name || mark(el);
      const siblings = name ? nodes.filter((n) => n instanceof HTMLInputElement && n.type === type && n.getAttribute("name") === name) : [el];
      if (siblings.length > 1) {
        if (seenGroups.has(key)) continue; seenGroups.add(key);
        const label = groupLabel(el, root) || labelTextFor(el, root);
        const options = siblings.map((s) => clean(labelTextFor(s, root)) || (s as HTMLInputElement).value).filter(Boolean);
        const checked = siblings.filter((s) => (s as HTMLInputElement).checked).map((s) => clean(labelTextFor(s, root)));
        out.push({ id: mark(el), label, kind: type === "radio" ? "radio" : "checkboxes", options, required: siblings.some((s) => isRequired(s, root, label)), filled: checked.length > 0, value: checked.join(", "), sensitive: SENSITIVE.test(label), conditional: CONDITIONAL.test(label) });
      } else {
        const label = labelTextFor(el, root);
        if (!label) continue;
        out.push({ id: mark(el), label, kind: type === "radio" ? "radio" : "checkbox", options: type === "radio" ? [label] : undefined, required: isRequired(el, root, label), filled: (el as HTMLInputElement).checked, sensitive: SENSITIVE.test(label), conditional: CONDITIONAL.test(label), legal: LEGAL.test(label) });
      }
      continue;
    }
    if (!isFillable(el)) continue;
    const label = labelTextFor(el, root);
    if (!label || label.length > 220) continue;
    const base = { id: mark(el), label, required: isRequired(el, root, label), sensitive: SENSITIVE.test(label), conditional: CONDITIONAL.test(label) };
    if (el instanceof HTMLSelectElement) {
      const opts = [...el.options].map((o) => o.text.trim()).filter((t) => t && !PLACEHOLDER.test(t));
      const cur = el.selectedIndex >= 0 ? el.options[el.selectedIndex]!.text.trim() : "";
      out.push({ ...base, kind: "select", options: opts, filled: !!el.value && !PLACEHOLDER.test(cur), value: cur });
    } else if (isCombobox(el)) {
      const shown = shownValue(el as HTMLInputElement);
      out.push({ ...base, kind: "combobox", filled: !!shown || !!(el as HTMLInputElement).value, value: shown || (el as HTMLInputElement).value });
    } else {
      const v = (el as HTMLInputElement).value ?? "";
      const kind: Kind = el instanceof HTMLTextAreaElement ? "textarea" : type === "number" ? "number" : type === "date" || type === "month" ? "date" : "text";
      out.push({ ...base, kind, filled: v.trim() !== "", value: v });
    }
  }
  return out;
}

/** Open a react-select once, read its options, close it. Server-searched lists come back empty and are flagged searchable. */
export async function readComboOptions(root: Document | ShadowRoot, field: ScannedField, budgetMs = 900): Promise<string[]> {
  const el = byId(root, field.id) as HTMLInputElement | null; if (!el) return [];
  clickLike(controlOf(el)); await sleep(150);
  let opts = listboxFor(el, root).map((o) => clean(o.textContent)).filter((t) => t && !/^(loading|no options|type to search|start typing)/i.test(t));
  const t0 = Date.now();
  while (!opts.length && Date.now() - t0 < budgetMs) { await sleep(150); opts = listboxFor(el, root).map((o) => clean(o.textContent)).filter((t) => t && !/^(loading|no options|type to search|start typing)/i.test(t)); }
  el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); mouse("mousedown", document.body); await sleep(60);
  if (!opts.length) field.searchable = true;
  return opts.slice(0, 80);
}

/** Put one answer into one scanned field. Returns true when the DOM shows it. */
export async function applyAnswer(root: Document | ShadowRoot, field: ScannedField, value: string | string[] | boolean): Promise<boolean> {
  const el = byId(root, field.id); if (!el) return false;
  const wantList = Array.isArray(value) ? value : [typeof value === "boolean" ? (value ? "Yes" : "No") : value];
  const matches = (labelText: string, w: string) => { const a = labelText.toLowerCase().trim(), b = w.toLowerCase().trim(); return a === b || a.startsWith(b) || (b.length > 3 && a.includes(b)) || (/^(yes|no)$/.test(b) && new RegExp(`^${b}\\b`).test(a)); };
  switch (field.kind) {
    case "radio": case "checkboxes": {
      const name = el.getAttribute("name"); const type = (el as HTMLInputElement).type;
      const group = name ? [...root.querySelectorAll<HTMLInputElement>(`input[type="${type}"][name="${name.replace(/"/g, '\\"')}"]`)] : [el as HTMLInputElement];
      let any = false;
      for (const w of wantList) { const hit = group.find((r) => matches(clean(labelTextFor(r, root)), w) || matches(r.value, w)); if (hit) { if (!hit.checked) hit.click(); any = any || hit.checked; } }
      return any;
    }
    case "checkbox": { const want = typeof value === "boolean" ? value : /^(yes|true|1|agree|accept)$/i.test(String(value)); return setValue(el as HTMLInputElement, want); }
    case "select": return wantList.map((w) => setValue(el as HTMLSelectElement, w)).some(Boolean);
    case "combobox": { let any = false; for (const w of wantList) any = (await pickCombobox(el as HTMLInputElement, w, root, { type: !!field.searchable || (field.options?.length ?? 0) > 12, budgetMs: field.searchable ? 6000 : 3000 })) || any; return any; }
    case "file": return false;
    default: return setValue(el as El, wantList.join(", "));
  }
}

/** Pick the option text that best matches an answer (same matcher the combobox picker uses). */
export const bestOptionText = (options: string[], want: string): string | null => {
  const fake = options.map((t) => ({ textContent: t }) as unknown as HTMLElement);
  const hit = bestOption(fake, want); return hit ? (hit.textContent as string) : null;
};
