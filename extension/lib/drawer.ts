/** In-page Rails drawer: the Jobright pattern (UI lives inside the tab, so it keeps working when you switch tabs), in Rails' skin. */
import { api, SITE, type JobInfo, type Me } from "./api";
import { ring, meter, logo, bandLabel, BAND, bandOf, levelLabel, logoUrl } from "./ui";
import { renderForm, summary, type FormState } from "./form";
import { prepare, run, fillOne, listOptions, learnCorrections, type RunInput } from "./runner";
import { isWorkday, wdStep, wdNextButton, wdErrors, watchSteps } from "./workday";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

type Tailor = { stage: "offer" | "working" | "preview" | "done" | "skipped"; text?: string; before?: number; after?: number; error?: string; added: Set<string>; evidenceFor: string | null };
type State = {
  open: boolean; busy: string | null; me: Me | null; job: JobInfo | null; input: RunInput | null; form: FormState | null; formOpen: boolean;
  tailor: Tailor; applied: "unknown" | "asked" | "yes" | "no"; pageKind: "job" | "confirmation" | "other"; status: string | null;
  wdAuto: boolean;
};
const state: State = { open: false, busy: null, me: null, job: null, input: null, form: null, formOpen: true, tailor: { stage: "offer", added: new Set(), evidenceFor: null }, applied: "unknown", pageKind: "other", status: null, wdAuto: false };

let host: HTMLElement | null = null; let root: ShadowRoot | null = null; let onOpenPanel: (() => void) | null = null;

const CSS = `
:host{all:initial}
*{box-sizing:border-box}
.drawer{position:fixed;top:0;right:0;height:100vh;width:400px;max-width:100vw;background:#F5F7FB;color:#2B3A55;font:13px/1.45 Inter,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;box-shadow:-12px 0 40px rgba(11,27,58,.18);z-index:2147483646;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .25s cubic-bezier(.2,.8,.2,1)}
.drawer.open{transform:translateX(0)}
.top{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#fff;border-bottom:1px solid #E6EAF2}
.wm{display:flex;align-items:center;gap:8px;font-weight:900;font-size:17px;letter-spacing:-.02em;color:#0B1B3A}
.pill{display:inline-flex;align-items:center;gap:6px;border:1px solid #E6EAF2;border-radius:999px;padding:3px 10px 3px 4px;font-size:11px;font-weight:700;color:#0B1B3A;background:#fff}
.av{width:20px;height:20px;border-radius:50%;background:#0B1B3A;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:800}
.x{border:0;background:transparent;font-size:20px;line-height:1;color:#6B7A93;cursor:pointer;padding:4px 6px;border-radius:8px}.x:hover{background:#F1F4F9;color:#0B1B3A}
.body{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.card{background:#fff;border:1px solid #E6EAF2;border-radius:16px;padding:14px;box-shadow:0 1px 2px rgba(11,27,58,.05),0 8px 24px rgba(11,27,58,.06)}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.muted{color:#6B7A93}.ink{color:#0B1B3A;font-weight:700}.note{font-size:11px;color:#6B7A93;line-height:1.45}
h2{margin:0;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#6B7A93}
.job-head{display:flex;gap:12px;align-items:flex-start}
.clogo{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;border:1px solid #E6EAF2;background:#fff;font-weight:800;color:#fff}
.job-co{font-weight:700;color:#0B1B3A}.job-sub{color:#6B7A93;font-size:12px}
.fitpill{margin-left:auto;display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0}.grade{font-size:9px;font-weight:800;letter-spacing:.12em}
.job-title{font-weight:800;font-size:17px;line-height:1.25;color:#0B1B3A;letter-spacing:-.01em;margin-top:10px}
.job-meta{display:flex;flex-wrap:wrap;gap:4px 10px;color:#6B7A93;font-size:12px;margin-top:6px}.job-meta b{color:#0B1B3A}
.meters{margin-top:12px;background:#F5F7FB;border:1px solid #E6EAF2;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:7px}
.chip{display:inline-block;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:700}.chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:12px;padding:9px 14px;font-weight:800;font-size:13px;cursor:pointer;background:#FF8A3D;color:#0B1B3A;font-family:inherit;transition:filter .15s}
.btn:hover{filter:brightness(1.04)}.btn.primary{width:100%;padding:14px;font-size:15px;border-radius:14px;box-shadow:0 6px 18px rgba(255,138,61,.35)}
.btn.secondary{background:#0B1B3A;color:#fff}.btn.ghost{background:#fff;border:1px solid #E6EAF2;color:#0B1B3A;font-weight:700}.btn.sm{padding:5px 10px;font-size:11px;border-radius:9px}.btn:disabled{opacity:.55;cursor:default;box-shadow:none}
.bar{height:10px;border-radius:999px;background:#E6EAF2;overflow:hidden}.bar span{display:block;height:10px;border-radius:999px;background:linear-gradient(90deg,#16A34A,#22C55E);width:0;transition:width .5s cubic-bezier(.2,.8,.2,1)}
.form-head{display:flex;justify-content:space-between;align-items:center;padding:12px 14px 8px;cursor:pointer}.form-head .t{font-weight:800;color:#0B1B3A;font-size:14px}.form-head .pct{font-weight:900;color:#0B1B3A;font-size:15px}
.q-list h2{padding:10px 14px 4px;font-size:12px;font-weight:800;color:#0B1B3A;text-transform:none;letter-spacing:0}
ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column}
.q{padding:7px 14px}.q-head{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:#0B1B3A}.q-label{flex:1;line-height:1.4}.q-val{max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#6B7A93;font-size:11px;padding-top:2px}
.st{width:20px;height:20px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;margin-top:1px}
.st-done{background:#22C55E;color:#fff}.st-left{background:#FFE8CC;color:#D97706}.st-fail{background:#FDECEC;color:#9F1D1D}.st-skip{background:#fff;color:#6B7A93;border:1.5px solid #E6EAF2}.st-todo{border:2px solid #E6EAF2}.st-run{background:#F5F7FB}
.spin{width:10px;height:10px;border:2px solid #E6EAF2;border-top-color:#FF8A3D;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.q-body{margin:6px 0 2px 30px;display:flex;flex-direction:column;gap:6px}
.pick,.txt{width:100%;font:12px Inter,-apple-system,"Segoe UI",sans-serif;border:1px solid #E6EAF2;border-radius:10px;padding:7px 10px;background:#fff;color:#0B1B3A}.pick:focus,.txt:focus{outline:2px solid #FF9E5C;outline-offset:1px}
.remember{font-size:11px;color:#6B7A93;display:flex;gap:5px;align-items:center}
.chev{width:18px;height:18px;border-radius:50%;background:#F5F7FB;display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:#6B7A93}
.kw{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:700;border:1px dashed #D6DEEA;background:#fff;color:#0B1B3A;cursor:pointer}.kw.on{border-style:solid;background:#DCFCE7;color:#166534;border-color:#DCFCE7}
pre{white-space:pre-wrap;font:11px/1.45 -apple-system,sans-serif;background:#F5F7FB;border:1px solid #E6EAF2;border-radius:10px;padding:10px;max-height:240px;overflow:auto;margin:8px 0 0;color:#0B1B3A}
.prompt{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#0B1B3A;color:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 12px 32px rgba(11,27,58,.35);font:600 13px/1.4 Inter,-apple-system,"Segoe UI",sans-serif;display:flex;gap:10px;align-items:center;max-width:460px}
.prompt .btn{padding:7px 12px;font-size:12px}
.footer{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#fff;border-top:1px solid #E6EAF2;font-size:12px}
.link{font-weight:700;color:#0B1B3A;text-decoration:none}.link:hover{text-decoration:underline}
`;

function companyLogo(job: JobInfo): string {
  const initials = (job.company ?? "").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "•";
  const src = job.companyLogo ?? logoUrl(job.companyDomain);
  return src ? `<div class="clogo"><img src="${esc(src)}" width="30" height="30" alt="" style="object-fit:contain" data-fb="${esc(initials)}"></div>` : `<div class="clogo" style="background:#0B1B3A">${esc(initials)}</div>`;
}
const ago = (iso?: string | null) => { if (!iso) return null; const d = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)); return d === 0 ? "Posted today" : d === 1 ? "Posted yesterday" : d < 7 ? `Posted ${d} days ago` : d < 30 ? `Posted ${Math.round(d / 7)}w ago` : `Posted ${Math.round(d / 30)}mo ago`; };

function jobCard(): string {
  const { job, me } = state;
  if (!me) return `<div class="card"><div class="ink">Connect Rails first</div><p class="note" style="margin:6px 0 10px">Sign in once and this drawer shows your fit for every job and fills applications from your profile.</p><a class="btn primary" style="text-decoration:none" href="${SITE}/ext/connect" target="_blank">Connect to Rails</a></div>`;
  if (!job) {
    if (state.pageKind === "confirmation") return `<div class="card"><div class="ink">Looks like a confirmation page</div><p class="note" style="margin:6px 0 0">Nothing to fill here. If you just submitted, mark it below so your tracker stays right.</p></div>`;
    return `<div class="card"><h2>This page</h2><div class="muted" style="margin-top:6px">${state.pageKind === "job" ? "A posting Rails hasn't scored yet." : "Open a job posting or an application form."}</div><button class="btn secondary" id="score" style="margin-top:10px" ${state.busy ? "disabled" : ""}>${state.busy === "score" ? "Scoring… (about 15 s)" : "Score this job"}</button></div>`;
  }
  const src = job.source ? ({ greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", smartrecruiters: "SmartRecruiters", workday: "Workday", usajobs: "USAJobs", workable: "Workable", jobvite: "Jobvite", icims: "iCIMS", oracle: "Oracle", paste: "this page" } as Record<string, string>)[job.source] ?? job.source : null;
  return `<div class="card">
    <div class="job-head">${companyLogo(job)}<div style="min-width:0"><div class="job-co">${esc(job.company)}</div><div class="job-sub">${[job.level ? levelLabel(job.level) : null, job.field ? job.field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null].filter(Boolean).map(esc).join(" · ")}</div></div>
      <div class="fitpill">${ring(job.fit, 56, { label: "Fit", suffix: "%", stroke: 5 })}<span class="grade" style="color:${BAND[bandOf(job.fit)]}">${job.fit == null ? "UNSCORED" : bandLabel(job.fit)}</span></div></div>
    <div class="job-title">${esc(job.title)}</div>
    <div class="job-meta">${[ago(job.postedAt), job.location ? esc(job.location) : job.remote ? "Remote" : null, job.pay ? `<b>${esc(job.pay)}</b>` : null, src ? `via ${esc(src)}` : null].filter(Boolean).join("<span>·</span>")}</div>
    <div class="meters">${job.sub ? [meter("Skills", job.sub.skills), meter("Experience", job.sub.experience), meter("Field", job.sub.field)].join("") : `<span class="note">Score arrives when the tagger finishes.</span>`}</div>
    ${job.hardBlocks.length ? `<div class="chips">${job.hardBlocks.map((b) => `<span class="chip" style="background:#FDECEC;color:#9F1D1D">✗ ${esc(b)}</span>`).join("")}</div>` : ""}
    ${(job.softNotes ?? []).length ? `<div class="chips">${job.softNotes!.map((b) => `<span class="chip" style="background:#FFE8CC;color:#D97706">! ${esc(b)}</span>`).join("")}</div>` : ""}
    <div class="row" style="margin-top:10px;justify-content:space-between"><a class="link" href="${esc(job.detailUrl)}" target="_blank">Open in Rails ↗</a>${job.stage ? `<span class="chip" style="background:#F5F7FB;color:#0B1B3A">${esc(job.stage)}</span>` : ""}</div>
  </div>`;
}

/** Jobright's "Generate your custom resume" step, honest version: only skills you confirm, preview before it is attached, skip keeps your upload. */
function tailorCard(): string {
  const { job, me, tailor } = state; if (!me || !job) return "";
  if (job.resume && tailor.stage === "offer") return "";
  const kw = job.keywords; const missing = kw?.missing ?? [];
  const credit = me.plan === "free" ? " · 1 credit" : "";
  if (tailor.stage === "offer") return `<div class="card">
    <h2>Prepare your resume</h2>
    <div class="ink" style="font-size:14px;margin-top:4px">Custom resume for this job</div>
    <p class="note" style="margin:4px 0 8px">Rewrites your bullets toward what this posting asks for, from your profile only. Keywords now: <b>${kw ? `${kw.matched.length}/${kw.matched.length + kw.missing.length}` : "—"}</b>.</p>
    ${missing.length ? `<div class="note" style="margin-bottom:4px">They also want. Tick only what you actually have; it goes on your profile.</div><div class="row" style="gap:4px">${missing.slice(0, 10).map((m) => `<button class="kw ${tailor.added.has(m.key) ? "on" : ""}" data-k="${esc(m.key)}">${tailor.added.has(m.key) ? "✓" : "+"} ${esc(m.key)}${m.required ? "" : " (nice to have)"}</button>`).join("")}</div>` : ""}
    ${tailor.evidenceFor ? `<div class="row" style="margin-top:8px;gap:4px"><input class="txt" id="ev" placeholder="Where did you use ${esc(tailor.evidenceFor)}? One line." style="flex:1"><button class="btn secondary sm" id="ev-ok">Add</button><button class="btn ghost sm" id="ev-no">Cancel</button></div>` : ""}
    <div class="row" style="margin-top:12px"><button class="btn secondary" id="tailor" ${!job.tagged || state.busy ? "disabled" : ""}>✦ Generate custom resume${credit}</button><button class="btn ghost" id="skip-tailor">Keep my resume</button></div>
    ${tailor.error ? `<p class="note" style="color:#9F1D1D;margin:6px 0 0">${esc(tailor.error)}</p>` : ""}
  </div>`;
  if (tailor.stage === "working") return `<div class="card"><div class="row"><span class="spin"></span><span class="ink">Tailoring your resume… about 20 s</span></div><p class="note" style="margin:6px 0 0">Every bullet keeps its source. Nothing is invented.</p></div>`;
  if (tailor.stage === "preview") return `<div class="card">
    <h2>Your custom resume</h2>
    <div class="row" style="margin-top:8px;gap:14px;align-items:center">${ring(tailor.after ?? 0, 64, { suffix: "%", label: "Keyword fit" })}<div><div class="ink" style="font-size:14px">Keyword fit ${tailor.before ?? 0}% → ${tailor.after ?? 0}%</div><div class="note">This is the PDF Rails will attach. Read it once; it's your name on it.</div></div></div>
    <pre>${esc(tailor.text ?? "")}</pre>
    <div class="row" style="margin-top:10px"><button class="btn" id="use-tailored">Looks good, use it</button><button class="btn ghost" id="use-original">Use my original</button><a class="link" style="margin-left:auto;font-size:12px" href="${esc(job.detailUrl)}/tailor/print" target="_blank">PDF ↗</a></div>
  </div>`;
  return "";
}

/** Workday: which step we are on, whether to fill every step on its own, and its Save and Continue (Submit stays the user's). */
function workdayCard(): string {
  if (!isWorkday() || !state.me) return "";
  const st = wdStep(); const done = !!state.form && !state.form.running;
  const names: Record<string, string> = { start: "Start", account: "Sign in / Create account", info: "My Information", experience: "My Experience", questions: "Application Questions", disclosures: "Voluntary Disclosures", identify: "Self Identify", review: "Review", unknown: "Application" };
  return `<div class="card">
    <div class="row" style="justify-content:space-between"><div><h2>Workday</h2><div class="ink" style="font-size:14px;margin-top:2px">${st.index ? `Step ${st.index} of ${st.total} · ` : ""}${esc(st.label || names[st.key])}</div></div>
      <label class="remember" title="After each step is filled, Rails clicks Workday's Save and Continue and fills the next step. Stops before Review."><input type="checkbox" id="wd-auto" ${state.wdAuto ? "checked" : ""}> Fill every step</label></div>
    ${st.key === "account" ? `<p class="note" style="margin:8px 0 0">Create the account yourself; Rails never types passwords. Once you're in, the drawer fills My Information.</p>` : ""}
    ${st.key === "review" ? `<p class="note" style="margin:8px 0 0">Read it through. Submit is yours.</p>` : ""}
    ${st.key === "identify" ? `<p class="note" style="margin:8px 0 0">Self-identification needs your own signature and date; Rails leaves it to you.</p>` : ""}
    ${done && st.key !== "review" && wdNextButton() ? `<button class="btn secondary" id="wd-next" style="margin-top:10px;width:100%">Save and Continue →</button>` : ""}
  </div>`;
}

function appliedPrompt(): string {
  if (state.applied !== "asked") return "";
  return `<div class="prompt" id="applied-prompt">${logo(22)}<span>Did you submit this application?</span><button class="btn" id="applied-yes">Yes, applied</button><button class="btn ghost" id="applied-no">Not yet</button></div>`;
}

function render() {
  if (!root) return;
  const { me, job, form, busy } = state;
  const initials = me ? (me.name ?? me.email).split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") : "";
  const canFill = !!me && state.pageKind !== "confirmation";
  const fillLabel = form?.running ? esc(form.step || "Filling…") : form ? "Autofill again" : "Autofill";
  const showTailor = canFill && !form && state.tailor.stage !== "skipped" && state.tailor.stage !== "done";
  root.querySelector(".drawer")?.remove(); root.querySelector("#applied-prompt")?.remove();
  const el = document.createElement("div"); el.className = `drawer ${state.open ? "open" : ""}`;
  el.innerHTML = `
    <div class="top"><span class="wm">${logo(24)} Rails</span><span class="row" style="gap:6px">${me ? `<span class="pill"><span class="av">${esc(initials)}</span>${me.plan === "free" ? `Free · ${me.credits} credits` : esc(me.plan === "pro" ? "Pro" : "Semester Pass")}</span>` : ""}<button class="x" id="close" title="Close">×</button></span></div>
    <div class="body">
      ${jobCard()}
      ${workdayCard()}
      ${canFill ? `<button class="btn primary" id="fill" ${busy || form?.running ? "disabled" : ""}>${fillLabel}</button>${form?.running ? `<p class="note" style="margin:-4px 2px 0;text-align:center">Runs inside this tab. You can switch tabs; it keeps going.</p>` : ""}` : ""}
      ${showTailor ? tailorCard() : ""}
      ${state.status ? `<p class="note">${esc(state.status)}</p>` : ""}
      ${form ? renderForm(form, state.formOpen) : ""}
    </div>
    <div class="footer"><a class="link" href="${SITE}/app" target="_blank">Open Rails ↗</a><button class="btn ghost sm" id="panel">Side panel</button></div>`;
  root.appendChild(el);
  const pr = document.createElement("div"); pr.innerHTML = appliedPrompt(); if (pr.firstElementChild) root.appendChild(pr.firstElementChild);
  bind();
  animateBar();
}

let lastBar = 0;
function animateBar() {
  const fill = root?.getElementById("bar-fill") as HTMLElement | null; if (!fill) return;
  const target = parseFloat(fill.dataset.w ?? "0");
  fill.style.transition = "none"; fill.style.width = `${lastBar}%`; void fill.offsetWidth; fill.style.transition = "width .5s cubic-bezier(.2,.8,.2,1)"; fill.style.width = `${target}%`; lastBar = target;
}

const q = <T extends Element>(sel: string) => root?.querySelector<T>(sel) ?? null;
function bind() {
  q<HTMLButtonElement>("#close")?.addEventListener("click", () => setOpen(false));
  q<HTMLButtonElement>("#panel")?.addEventListener("click", () => onOpenPanel?.());
  q<HTMLButtonElement>("#fill")?.addEventListener("click", () => void startFill());
  q<HTMLButtonElement>("#score")?.addEventListener("click", () => void score());
  q<HTMLButtonElement>("#tailor")?.addEventListener("click", () => void tailorNow());
  q<HTMLButtonElement>("#skip-tailor")?.addEventListener("click", () => { state.tailor.stage = "skipped"; render(); });
  q<HTMLButtonElement>("#use-tailored")?.addEventListener("click", () => { state.tailor.stage = "done"; state.input = null; render(); void startFill(); });
  q<HTMLButtonElement>("#use-original")?.addEventListener("click", () => { state.tailor.stage = "skipped"; render(); });
  for (const b of root?.querySelectorAll<HTMLButtonElement>(".kw") ?? []) b.addEventListener("click", () => { const k = b.dataset.k!; if (state.tailor.added.has(k)) return; state.tailor.evidenceFor = k; render(); q<HTMLInputElement>("#ev")?.focus(); });
  q<HTMLButtonElement>("#ev-ok")?.addEventListener("click", () => void addSkill());
  q<HTMLInputElement>("#ev")?.addEventListener("keydown", (e) => { if (e.key === "Enter") void addSkill(); });
  q<HTMLButtonElement>("#ev-no")?.addEventListener("click", () => { state.tailor.evidenceFor = null; render(); });
  q<HTMLButtonElement>("#applied-yes")?.addEventListener("click", () => void markApplied(true));
  q<HTMLButtonElement>("#applied-no")?.addEventListener("click", () => void markApplied(false));
  q<HTMLElement>("#form-head")?.addEventListener("click", () => { state.formOpen = !state.formOpen; render(); });
  q<HTMLInputElement>("#wd-auto")?.addEventListener("change", (e) => { state.wdAuto = (e.target as HTMLInputElement).checked; chrome.storage.local.set({ rails_wd_auto: state.wdAuto }).catch(() => {}); });
  q<HTMLButtonElement>("#wd-next")?.addEventListener("click", () => void wdNext());
  for (const img of root?.querySelectorAll<HTMLImageElement>(".clogo img") ?? []) img.onerror = () => { const d = img.parentElement!; d.style.background = "#0B1B3A"; d.textContent = img.dataset.fb ?? "•"; };
  const fs = state.form; if (!fs) return;
  for (const sel of root?.querySelectorAll<HTMLSelectElement>(".pick:not([multiple])") ?? []) sel.onchange = () => { if (sel.value) void one(sel.dataset.id!, sel.value); };
  for (const b of root?.querySelectorAll<HTMLButtonElement>(".act-multi") ?? []) b.onclick = () => { const sel = q<HTMLSelectElement>(`.pick[data-id="${b.dataset.id}"]`); const vals = sel ? [...sel.selectedOptions].map((o) => o.value).filter(Boolean) : []; if (vals.length) void one(b.dataset.id!, vals); };
  for (const b of root?.querySelectorAll<HTMLButtonElement>(".act") ?? []) b.onclick = () => void one(b.dataset.id!, true);
  for (const b of root?.querySelectorAll<HTMLButtonElement>(".act-txt") ?? []) b.onclick = () => { const t = q<HTMLInputElement>(`.txt[data-id="${b.dataset.id}"]`); if (t?.value.trim()) void one(b.dataset.id!, t.value.trim()); };
  for (const t of root?.querySelectorAll<HTMLInputElement>("input.txt[data-id]") ?? []) t.onkeydown = (e) => { if (e.key === "Enter" && t.value.trim()) void one(t.dataset.id!, t.value.trim()); };
  for (const b of root?.querySelectorAll<HTMLButtonElement>(".list") ?? []) b.onclick = async () => { await listOptions(fs, b.dataset.id!); render(); };
}
const rememberFlags = new Set<string>();
async function one(id: string, v: string | string[] | boolean) {
  const fs = state.form; if (!fs) return;
  const rem = (q<HTMLInputElement>(`.rem[data-id="${id}"]`)?.checked) ?? rememberFlags.has(id);
  render(); await fillOne(fs, id, v, rem); render(); broadcast();
}

async function addSkill() {
  const k = state.tailor.evidenceFor; const ev = q<HTMLInputElement>("#ev")?.value.trim() ?? ""; if (!k) return;
  try { await api.addSkill(k, ev); state.tailor.added.add(k); state.me = await api.me(); state.job = (await api.job(location.href)).job ?? state.job; } catch { state.status = "Could not add that skill."; }
  state.tailor.evidenceFor = null; render();
}

async function tailorNow() {
  const job = state.job; if (!job) return;
  state.tailor.stage = "working"; state.tailor.error = undefined; render();
  try { const r = await api.tailor(job.id); state.tailor = { ...state.tailor, stage: "preview", text: r.text, before: r.coverageBefore, after: r.coverageAfter }; state.job = { ...job, resume: r.text, resumeScore: r.coverageAfter }; state.me = await api.me(); }
  catch (e) { const m = String((e as Error).message); state.tailor.stage = "offer"; state.tailor.error = m.startsWith("locked") ? `Out of credits. Refill in ${m.split(":")[1]} or upgrade at ${SITE}/pricing.` : "Tailoring failed. Try again in a minute."; }
  render();
}

async function score() {
  state.busy = "score"; render();
  try { const ld = pageJobLd(); const r = await api.score({ url: location.href, text: document.body.innerText.slice(0, 20000), title: ld?.title ?? document.title, company: ld?.company ?? undefined }); state.job = r.job; state.pageKind = "job"; state.status = r.job.tagged ? null : "Saved. The score arrives when the tagger finishes (a few minutes)."; }
  catch (e) { state.status = `Could not score this page (${String((e as Error).message)}).`; }
  state.busy = null; render(); broadcast();
}

/** schema.org JobPosting embedded by Greenhouse, Lever, Workday, Ashby and most career sites. */
export function pageJobLd(): { title: string; company: string | null; posted: string | null; location: string | null } | null {
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(s.textContent ?? ""); const list = Array.isArray(data) ? data : data["@graph"] ?? [data];
      const jp = list.find((x: { "@type"?: string | string[] }) => [x?.["@type"]].flat().includes("JobPosting"));
      if (jp?.title) { const org = typeof jp.hiringOrganization === "string" ? jp.hiringOrganization : jp.hiringOrganization?.name; const loc = jp.jobLocation?.[0]?.address ?? jp.jobLocation?.address; return { title: String(jp.title).trim(), company: org ? String(org).trim() : null, posted: jp.datePosted ?? null, location: loc ? [loc.addressLocality, loc.addressRegion].filter(Boolean).join(", ") : null }; }
    } catch { /* next */ }
  }
  return null;
}
function detectPageKind(): State["pageKind"] {
  const t = `${document.title} ${location.pathname}`.toLowerCase();
  if (/confirm|thank you|thanks for applying|application (submitted|received|complete)|submitted successfully/.test(t)) return "confirmation";
  if (pageJobLd() || /\/jobs?\/|\/job\/|\/careers?\/|\/positions?\/|\/openings?\/|apply/.test(location.pathname)) return "job";
  return "other";
}

async function startFill() {
  if (state.form?.running) return;
  if (!state.input) { state.busy = "prep"; state.status = null; render(); const p = await prepare(); if ("error" in p) { state.busy = null; state.status = p.error === "not_connected" ? "Connect Rails first." : `Could not load your profile (${p.error}).`; render(); return; } state.input = p; state.me = p.me; state.job = p.job ?? state.job; state.busy = null; }
  const fs: FormState = { rows: [], running: true, step: "Reading the form…", url: location.href, tabId: -1 };
  state.form = fs; state.formOpen = true; render();
  await run(state.input, fs, () => { render(); broadcast(); });
  render(); broadcast();
  watchForSubmit();
}

/** After a fill: ask once when the user comes back to the tab or clicks something that looks like Submit. */
let submitWatch = false;
function watchForSubmit() {
  if (submitWatch) return; submitWatch = true;
  const ask = () => { if (state.applied === "unknown" && state.form && !state.form.running) { state.applied = "asked"; render(); } };
  document.addEventListener("click", (e) => { const b = (e.target as HTMLElement).closest("button, input[type=submit], a[role=button]"); if (b && /submit|apply|send application|finish/i.test((b.textContent ?? "") + ((b as HTMLInputElement).value ?? ""))) setTimeout(ask, 2500); }, true);
  let hiddenAt = 0;
  document.addEventListener("visibilitychange", () => { if (document.hidden) hiddenAt = Date.now(); else if (hiddenAt && Date.now() - hiddenAt > 15000) ask(); });
  window.addEventListener("beforeunload", () => { void learnCorrections(state.form!); });
}
async function markApplied(yes: boolean) {
  state.applied = yes ? "yes" : "no"; render();
  if (state.form) { const n = await learnCorrections(state.form); if (n) state.status = `Remembered ${n} answer${n === 1 ? "" : "s"} you corrected for next time.`; }
  if (yes) { try { await api.applied({ url: location.href, jobId: state.job?.id, title: state.job?.title ?? pageJobLd()?.title ?? document.title, company: state.job?.company ?? pageJobLd()?.company ?? location.hostname }); state.status = "Marked as applied. It's on your tracker."; } catch { state.status = "Could not reach Rails to mark it; add it on the tracker."; } }
  render();
}

async function wdNext() {
  const b = wdNextButton(); if (!b) return;
  b.click(); state.status = "Saving this step…"; render();
  await new Promise((r) => setTimeout(r, 1800));
  const errs = wdErrors();
  if (errs.length) { state.status = `Workday flagged: ${errs.slice(0, 3).join(" · ")}`; if (state.form) { for (const e of errs) state.form.rows.unshift({ f: { id: `wderr:${e.slice(0, 40)}`, label: e, kind: "text", required: true, filled: false, sensitive: false, conditional: false }, s: "left", why: "Fix this on the page, then Save and Continue." }); } }
  else state.status = null;
  render();
}

function broadcast() { try { chrome.runtime.sendMessage({ type: "rails:state", form: state.form, job: state.job, url: location.href }).catch(() => {}); } catch { /* panel closed */ } }

export function setOpen(open: boolean) { state.open = open; render(); }
export function isOpen() { return state.open; }
export function getState() { return state; }
export async function loadJob() {
  state.pageKind = detectPageKind();
  try { state.me = await api.me(); } catch { state.me = null; }
  if (state.me) { try { state.job = (await api.job(location.href)).job; } catch { state.job = null; } }
  render();
  return state.job;
}
/** Score a posting the moment the page opens, so the badge shows a number without a click. Only real postings (schema.org JobPosting), never confirmation or search pages. */
export async function autoScore(): Promise<JobInfo | null> {
  if (!state.me || state.job || state.pageKind !== "job" || !pageJobLd()) return null;
  await score(); return state.job;
}

export function mountDrawer(opts: { openPanel: () => void }) {
  if (host) return;
  onOpenPanel = opts.openPanel;
  host = document.createElement("div"); host.id = "rails-drawer-host"; host.style.cssText = "all:initial";
  root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style"); style.textContent = CSS; root.appendChild(style);
  (document.body ?? document.documentElement).appendChild(host);
  render();
  if (isWorkday()) {
    chrome.storage.local.get("rails_wd_auto").then((r) => { state.wdAuto = r.rails_wd_auto === true; render(); }).catch(() => {});
    watchSteps((step) => {
      state.form = null; state.input = null; state.status = null; render();
      if (state.wdAuto && state.me && ["info", "experience", "questions", "disclosures"].includes(step.key)) { setOpen(true); void startFill().then(async () => { if (state.wdAuto && state.form && !state.form.error && state.form.rows.every((r) => r.s !== "left" && r.s !== "failed")) await wdNext(); }); }
      else if (["info", "experience", "questions", "disclosures"].includes(step.key)) { state.status = `New step: ${step.label}. Autofill fills it.`; setOpen(true); render(); }
    });
  }
  chrome.runtime.onMessage.addListener((msg, _s, send) => {
    if (msg?.type === "rails:run") { setOpen(true); void startFill(); send({ ok: true }); return false; }
    if (msg?.type === "rails:open-drawer") { setOpen(!state.open); send({ ok: true }); return false; }
    if (msg?.type === "rails:get-state") { send({ form: state.form, job: state.job, url: location.href }); return false; }
    if (msg?.type === "rails:fill-one" && state.form) { if (msg.list) { void listOptions(state.form, msg.id).then(() => { render(); broadcast(); }); } else void one(msg.id, msg.value); send({ ok: true }); return false; }
    return false;
  });
}
