import type { ScannedField } from "../../lib/scan";

/** The checklist the panel shows while and after autofill: every question on the page, its state, and a control for the ones left. */
export type RowState = "todo" | "filling" | "done" | "left" | "skip" | "failed";
export type Row = { f: ScannedField; s: RowState; why?: string; value?: string };
export type FormState = { rows: Row[]; running: boolean; step: string; url: string };

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
/** Saved answers are keyed by the question text, lower-cased and stripped of punctuation, so the same question on another site matches. */
export const answerKey = (label: string) => label.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);

export function summary(fs: FormState) {
  const req = fs.rows.filter((r) => r.f.required && r.s !== "skip");
  const done = req.filter((r) => r.s === "done").length;
  const all = fs.rows.filter((r) => r.s !== "skip"); const allDone = all.filter((r) => r.s === "done").length;
  const pct = req.length ? Math.round((100 * done) / req.length) : all.length ? Math.round((100 * allDone) / all.length) : 0;
  return { req: req.length, done, pct };
}

const ICON: Record<RowState, string> = {
  done: `<span class="st st-done" title="Filled">✓</span>`, filling: `<span class="st st-run" title="Filling"><span class="spin"></span></span>`, todo: `<span class="st st-todo"></span>`,
  left: `<span class="st st-left" title="Needs you">!</span>`, skip: `<span class="st st-skip" title="Only if another answer applies">–</span>`, failed: `<span class="st st-fail" title="Could not set it; pick below">×</span>`,
};

/** Control for a row that needs the user: a dropdown when the page has a list, a text box otherwise, a single button for a checkbox. */
function control(r: Row): string {
  const f = r.f; const id = esc(f.id);
  if (f.kind === "file") return `<span class="note">Attach it on the page.</span>`;
  if (f.kind === "checkbox") return `<button class="btn ghost act" data-id="${id}" data-v="true" style="padding:4px 10px;font-size:11px">Tick it</button>`;
  const opts = f.options ?? [];
  if (opts.length) {
    const multi = f.kind === "checkboxes";
    return `<select class="pick" data-id="${id}" ${multi ? "multiple size=4" : ""}><option value="">${multi ? "Pick one or more…" : "Pick an answer…"}</option>${opts.map((o) => `<option value="${esc(o)}" ${r.value && r.value.split(", ").includes(o) ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>${multi ? `<button class="btn ghost act-multi" data-id="${id}" style="padding:4px 10px;font-size:11px">Fill</button>` : ""}`;
  }
  if (f.kind === "combobox") return `<div class="row" style="gap:4px"><input class="txt" data-id="${id}" placeholder="${f.searchable ? "Type to search the list, then Enter" : "Type the option, then Enter"}" value="${esc(r.value ?? "")}"><button class="btn ghost act-txt" data-id="${id}" style="padding:4px 10px;font-size:11px">Fill</button></div>`;
  const tall = f.kind === "textarea";
  return `<div class="row" style="gap:4px;align-items:flex-start">${tall ? `<textarea class="txt" data-id="${id}" rows="3" placeholder="Your answer…">${esc(r.value ?? "")}</textarea>` : `<input class="txt" data-id="${id}" placeholder="Your answer…" value="${esc(r.value ?? "")}">`}<button class="btn ghost act-txt" data-id="${id}" style="padding:4px 10px;font-size:11px">Fill</button></div>`;
}

function row(r: Row, open: boolean): string {
  const needs = r.s === "left" || r.s === "failed" || r.s === "todo";
  return `<li class="q ${needs ? "q-open" : ""}" data-id="${esc(r.f.id)}">
    <div class="q-head">${ICON[r.s]}<span class="q-label">${esc(r.f.label)}</span>${r.s === "done" && r.value ? `<span class="q-val" title="${esc(r.value)}">${esc(r.value)}</span>` : ""}</div>
    ${needs && open ? `<div class="q-body">${r.why ? `<div class="note" style="margin-bottom:4px">${esc(r.why)}</div>` : ""}${control(r)}<label class="remember"><input type="checkbox" class="rem" data-id="${esc(r.f.id)}"> Remember for other applications</label></div>` : ""}
  </li>`;
}

export function renderForm(fs: FormState, expanded: boolean): string {
  const s = summary(fs);
  const required = fs.rows.filter((r) => r.f.required); const optional = fs.rows.filter((r) => !r.f.required);
  const bar = `<div class="bar"><span id="bar-fill" data-w="${s.pct}"></span></div>`;
  const head = fs.running ? `<span class="ink">${esc(fs.step)}</span><span class="ink">${s.pct}%</span>` : `<span class="ink">${s.done}/${s.req} required filled</span><span class="ink">${s.pct}%</span>`;
  return `<div class="card" style="padding:0">
    <div class="row" style="justify-content:space-between;padding:10px 12px 6px;cursor:pointer" id="form-head">${head}</div>
    <div style="padding:0 12px 8px">${bar}</div>
    ${expanded ? `<div class="q-list">
      ${required.length ? `<h2 style="padding:4px 12px 0">Required</h2><ul>${required.map((r) => row(r, !fs.running)).join("")}</ul>` : ""}
      ${optional.length ? `<h2 style="padding:8px 12px 0">Optional</h2><ul>${optional.map((r) => row(r, !fs.running)).join("")}</ul>` : ""}
      <p class="note" style="padding:6px 12px 10px;margin:0">Pick an answer for anything marked ! and Rails puts it in the form. Pronouns, EEO and "how did you hear" stay on this computer. Review the page, then click its Submit.</p>
    </div>` : ""}
  </div>`;
}
