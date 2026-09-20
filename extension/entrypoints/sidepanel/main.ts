import { api, getToken, setToken, SITE, type JobInfo, type Me } from "../../lib/api";
import { ring, meter, logo, bandLabel, BAND, bandOf, levelLabel, logoUrl } from "../../lib/ui";
import { renderForm, answerKey, summary, type FormState, type Row } from "./form";
import type { ScannedField } from "../../lib/scan";

const app = document.getElementById("app")!;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const b64 = (buf: ArrayBuffer) => { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };

type FileInfo = { kind: "resume" | "letter"; name: string; type: string; origin: string; bytes: ArrayBuffer } | null;
type State = { me: Me | null; job: JobInfo | null; tabUrl: string | null; status: string | null; needsPermission: string | null; lastFill: { filled: number; attempted: number; left: string[] } | null; busy: "score" | "tailor" | "letter" | "fill" | null; show: { resume: boolean; letter: boolean; fields: boolean; diff: boolean }; resume: FileInfo; letter: FileInfo; added: Set<string>; form: FormState | null; formOpen: boolean; saved: Record<string, string | string[] | boolean> };
const state: State = { me: null, job: null, tabUrl: null, status: null, needsPermission: null, lastFill: null, busy: null, show: { resume: false, letter: false, fields: false, diff: true }, resume: null, letter: null, added: new Set(), form: null, formOpen: true, saved: {} };

async function activeTabUrl(): Promise<string | null> { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); return tab?.url ?? null; }

/** Profile completeness for the red-dot row: the fields forms ask for most. */
function completeness(me: Me): { pct: number; missing: string[] } {
  const f = me.fields; const want: [string, unknown][] = [["phone", f.phone], ["LinkedIn", f.linkedin], ["city", f.city], ["state", f.state], ["street", f.street], ["ZIP", f.zip], ["school", f.school], ["degree", f.degree], ["major", f.major], ["start year", f.startYear], ["grad year", f.gradYear], ["work authorization", f.workAuthorized]];
  const missing = want.filter(([, v]) => v == null || v === "").map(([k]) => k);
  return { pct: Math.round(100 * (want.length - missing.length) / want.length), missing };
}

/** Tell the on-page badge the fit for this tab and cache it per URL so the badge shows it before the panel opens. */
async function pushBadge() {
  const fit = state.job?.fit ?? null;
  try { await chrome.runtime.sendMessage({ type: "rails:badge", fit }); } catch { /* no badge on this page */ }
  if (state.tabUrl && fit != null) { try { const r = await chrome.storage.local.get("rails_fit_cache"); const c = (r.rails_fit_cache ?? {}) as Record<string, number>; c[state.tabUrl.split("#")[0]!] = fit; const keys = Object.keys(c); if (keys.length > 300) for (const k of keys.slice(0, keys.length - 300)) delete c[k]; await chrome.storage.local.set({ rails_fit_cache: c }); } catch { /* ignore */ } }
}

/** Company mark: its logo when Rails knows the domain, initials otherwise; a broken image falls back to initials. */
function companyLogo(job: JobInfo, initials: string): string {
  const src = job.companyLogo ?? logoUrl(job.companyDomain);
  const fallback = `<div class="clogo" style="background:var(--ink);color:#fff;font-weight:800">${esc(initials)}</div>`;
  if (!src) return fallback;
  return `<div class="clogo" style="background:#fff;border:1px solid var(--line)"><img src="${esc(src)}" width="28" height="28" alt="" style="object-fit:contain" data-fallback="${esc(initials)}"></div>`;
}

let lastBar = 0;
/** Re-rendering swaps the DOM, which kills CSS transitions; start the new bar at the old width and let it glide. */
function animateBar() {
  const fill = document.getElementById("bar-fill"); if (!fill) return;
  const target = parseFloat(fill.dataset.w ?? "0");
  fill.style.transition = "none"; fill.style.width = `${lastBar}%`; void fill.offsetWidth;
  fill.style.transition = "width .5s cubic-bezier(.2,.8,.2,1)"; fill.style.width = `${target}%`;
  lastBar = target;
}

function render() {
  const { me, job } = state;
  void pushBadge();
  if (!me) {
    app.innerHTML = `<div class="card"><div class="brand"><span class="row" style="gap:6px">${logo(22)} Rails</span> <small>not connected</small></div>
      <p>Connect once and the panel shows your fit for the job on this tab and fills applications from your profile.</p>
      <button class="btn" id="connect">Connect to Rails</button>
      <p class="note" style="margin-top:8px">Opens rails-psi.vercel.app in a tab. Sign in there if asked, then come back.</p>
      ${state.status ? `<p class="note">${esc(state.status)}</p>` : ""}</div>`;
    document.getElementById("connect")!.onclick = () => chrome.tabs.create({ url: `${SITE}/ext/connect` });
    return;
  }
  const f = me.fields; const comp = completeness(me); const busy = state.busy;
  const initials = (job?.company ?? "").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "•";
  const kw = job?.keywords; const missingReq = kw?.missing.filter((m) => m.required) ?? []; const missingPref = kw?.missing.filter((m) => !m.required) ?? [];
  const titleLine = job?.titleMatch === "strong" ? "Title matches what you're aiming for." : job?.titleMatch === "partial" ? `Title is close to your target (${esc(job.yourTitle ?? "")}).` : job?.titleMatch === "none" ? `Title is far from your target (${esc(job.yourTitle ?? "your roles")}).` : "";
  const fields: [string, unknown][] = [["Name", f.fullName], ["Preferred", f.preferredName], ["Email", f.email], ["Phone", f.phone], ["LinkedIn", f.linkedin], ["GitHub", f.github], ["Portfolio", f.portfolio], ["Street", f.street], ["City", f.city], ["State", f.state], ["ZIP", f.zip], ["School", f.school], ["Degree", f.degree], ["Major", f.major], ["Start year", f.startYear], ["Grad year", f.gradYear], ["GPA", f.gpa]];

  app.innerHTML = `
    <div class="brand" style="padding:2px 2px 0"><span class="row" style="gap:6px">${logo(22)} Rails</span> <small>${esc(me.name ?? me.email)} · ${me.plan === "free" ? `${me.credits} credits` : esc(String(me.plan).toUpperCase())}</small></div>

    ${job ? `<div class="card">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div class="row" style="gap:10px">${companyLogo(job, initials)}<div><div class="ink">${esc(job.company)}</div><div class="muted">${esc(job.location ?? "")}${job.level ? `${job.location ? " · " : ""}${esc(levelLabel(job.level))}` : ""}</div></div></div>
      </div>
      <div style="font-weight:800;font-size:15px;color:var(--ink);margin-top:8px;line-height:1.3">${esc(job.title)}</div>
      <div class="row" style="gap:12px;margin-top:10px;align-items:center;background:var(--light);border:1px solid var(--line);border-radius:10px;padding:8px 10px">
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px">${ring(job.fit, 68, { label: "Fit" })}<span style="font-size:9px;font-weight:800;letter-spacing:.1em;color:${BAND[bandOf(job.fit)]}">${job.fit == null ? "NOT SCORED" : bandLabel(job.fit)}</span></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px">${job.sub ? [meter("Skills", job.sub.skills), meter("Experience", job.sub.experience), meter("Field", job.sub.field)].join("") : `<span class="note">Score arrives when the tagger finishes.</span>`}</div>
      </div>
      ${job.hardBlocks.length ? `<div style="margin-top:6px">${job.hardBlocks.map((b) => `<span class="chip" style="background:var(--red-bg);color:var(--red)">✗ ${esc(b)}</span>`).join(" ")}</div>` : ""}
      ${(job.softNotes ?? []).length ? `<div style="margin-top:6px">${job.softNotes!.map((b) => `<span class="chip" style="background:var(--amber-bg);color:var(--amber)">! ${esc(b)}</span>`).join(" ")}</div>` : ""}
      <div class="row" style="margin-top:8px"><a class="muted" style="font-size:11px" href="${esc(job.detailUrl)}" target="_blank">Open in Rails ↗</a></div>
    </div>` : `<div class="card"><h2>This page</h2><div class="muted">${state.tabUrl ? "Not a job Rails knows yet. Score it here and it joins your feed; autofill works either way." : "Open a job posting or application form."}</div>${state.tabUrl && /^https?:/.test(state.tabUrl) ? `<button class="btn secondary" style="margin-top:8px" id="score" ${busy ? "disabled" : ""}>${busy === "score" ? "Scoring… (about 15 s)" : "Score this job"}</button>` : ""}</div>`}

    ${state.needsPermission ? `<div class="card"><p>Rails needs permission to read and fill forms on <b>${esc(new URL(state.needsPermission).hostname)}</b>. Nothing leaves the page except which fields were filled.</p><button class="btn" id="grant" style="width:100%">Allow on this site</button></div>`
      : `<button class="btn" id="fill" style="width:100%;padding:12px;font-size:15px" ${busy ? "disabled" : ""}>${busy === "fill" ? esc(state.form?.step ?? "Filling…") : state.form ? "Autofill again" : "Autofill this page"}</button>`}
    ${state.form ? renderForm(state.form, state.formOpen) : ""}
    ${state.status ? `<p class="note" style="margin:-4px 2px 0">${esc(state.status)}</p>` : ""}

    <div class="card" style="padding:0">
      <div class="row" style="justify-content:space-between;padding:10px 12px;cursor:pointer" id="row-info"><span class="ink">Your autofill information</span><span class="row" style="gap:6px">${ring(comp.pct, 30, { suffix: "", label: "Complete", stroke: 4, color: comp.pct === 100 ? "var(--green)" : comp.pct >= 70 ? "var(--amber)" : "var(--red)" })}<span class="muted">${state.show.fields ? "▾" : "▸"}</span></span></div>
      ${state.show.fields ? `<div style="padding:0 12px 10px">${comp.missing.length ? `<p class="note" style="margin:0 0 6px">Missing: ${esc(comp.missing.join(", "))}. <a href="${SITE}/onboarding/confirm" target="_blank">Edit profile ↗</a></p>` : ""}<ul>${fields.filter(([, v]) => v).map(([k, v]) => `<li class="field"><div><div class="k">${esc(k)}</div><div class="v" title="${esc(v)}">${esc(v)}</div></div><button class="copy" data-v="${esc(v)}">Copy</button></li>`).join("")}</ul></div>` : ""}

      <div style="border-top:1px solid var(--line);padding:10px 12px">
        <div class="row" style="justify-content:space-between"><span class="ink">Resume</span><span class="muted" style="font-size:11px">${state.resume ? `${state.resume.origin === "tailored" ? "Tailored for this job" : "Your upload"}: ${esc(state.resume.name)}` : "No resume on file"}</span></div>
        ${job && !job.resume && state.show.diff && (kw || titleLine) ? `<div style="margin-top:8px;background:var(--light);border:1px solid var(--line);border-radius:8px;padding:8px">
          <div class="muted" style="font-size:11px;font-weight:800;letter-spacing:.05em">SEE YOUR DIFFERENCE</div>
          ${titleLine ? `<div style="margin-top:4px;font-size:12px">${titleLine}</div>` : ""}
          ${kw ? `<div style="margin-top:6px;font-size:12px"><span class="ink">Keywords ${kw.matched.length}/${kw.matched.length + kw.missing.length}</span></div>
          <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">${kw.matched.map((k) => `<span class="chip" style="background:var(--green-bg);color:var(--green)">✓ ${esc(k)}</span>`).join("")}${[...missingReq, ...missingPref].map((m) => state.added.has(m.key) ? `<span class="chip" style="background:var(--green-bg);color:var(--green)">✓ ${esc(m.key)}</span>` : `<button class="chip add-skill" data-k="${esc(m.key)}" style="border:1px dashed var(--line);background:#fff;cursor:pointer;color:var(--ink)" title="Only if you actually have it. It goes on your profile and every score updates.">+ ${esc(m.key)}${m.required ? "" : " (nice to have)"}</button>`).join("")}</div>
          <p class="note" style="margin:6px 0 0">Click a keyword only if you really have it. Rails never writes skills into your resume that aren't on your profile; that's what recruiters catch.</p>` : ""}
        </div>` : ""}
        <div class="row" style="margin-top:8px">
          ${job ? (job.resume ? `<button class="btn ghost" id="toggle-resume">${state.show.resume ? "Hide" : "View"} tailored${job.resumeScore != null ? ` (${job.resumeScore}%)` : ""}</button><button class="btn ghost" id="copy-resume">Copy text</button><a class="btn ghost" href="${esc(job.detailUrl)}/tailor/print" target="_blank">PDF ↗</a>`
            : `<button class="btn secondary" id="tailor" ${busy || !job.tagged ? "disabled" : ""}>${busy === "tailor" ? "Tailoring… (about 20 s)" : `✦ Generate custom resume${me.plan === "free" ? " · 1 credit" : ""}`}</button>`) : `<span class="note">Score the job to tailor for it.</span>`}
        </div>
        ${job?.resume && state.show.resume ? `<pre>${esc(job.resume)}</pre>` : ""}
      </div>

      <div style="border-top:1px solid var(--line);padding:10px 12px">
        <div class="row" style="justify-content:space-between"><span class="ink">Cover letter</span><span class="muted" style="font-size:11px">${job?.coverLetter ? "Ready, attached when the form asks" : "Only if the form asks"}</span></div>
        <div class="row" style="margin-top:8px">
          ${job ? (job.coverLetter ? `<button class="btn ghost" id="toggle-letter">${state.show.letter ? "Hide" : "View"}</button><button class="btn ghost" id="copy-letter">Copy text</button>` : `<button class="btn ghost" id="letter" ${busy || !job.tagged ? "disabled" : ""}>${busy === "letter" ? "Writing… (about 15 s)" : `✦ Generate cover letter${me.plan === "free" ? " · 1 credit" : ""}`}</button>`) : ""}
        </div>
        ${job?.coverLetter && state.show.letter ? `<pre>${esc(job.coverLetter)}</pre>` : ""}
      </div>
    </div>
    <div class="row" style="justify-content:space-between;padding:0 2px"><a class="muted" href="${SITE}/app" target="_blank">Open Rails</a><button class="btn ghost" id="disconnect" style="padding:4px 10px;font-size:11px">Disconnect</button></div>`;

  for (const b of app.querySelectorAll<HTMLButtonElement>(".copy")) b.onclick = async () => { await navigator.clipboard.writeText(b.dataset.v ?? ""); b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1200); };
  for (const b of app.querySelectorAll<HTMLButtonElement>(".add-skill")) b.onclick = () => addSkill(b.dataset.k ?? "");
  document.getElementById("row-info")?.addEventListener("click", () => { state.show.fields = !state.show.fields; render(); });
  document.getElementById("copy-resume")?.addEventListener("click", () => navigator.clipboard.writeText(job?.resume ?? ""));
  document.getElementById("copy-letter")?.addEventListener("click", () => navigator.clipboard.writeText(job?.coverLetter ?? ""));
  document.getElementById("toggle-resume")?.addEventListener("click", () => { state.show.resume = !state.show.resume; render(); });
  document.getElementById("toggle-letter")?.addEventListener("click", () => { state.show.letter = !state.show.letter; render(); });
  document.getElementById("disconnect")?.addEventListener("click", async () => { await setToken(null); state.me = null; render(); });
  document.getElementById("grant")?.addEventListener("click", async () => {
    const ok = await chrome.permissions.request({ origins: [state.needsPermission!] });
    if (ok) { state.needsPermission = null; await doFill(); } else { state.status = "Permission declined."; render(); }
  });
  document.getElementById("fill")?.addEventListener("click", doFill);
  document.getElementById("form-head")?.addEventListener("click", () => { state.formOpen = !state.formOpen; render(); });
  for (const sel of app.querySelectorAll<HTMLSelectElement>(".pick:not([multiple])")) sel.onchange = () => { if (sel.value) void fillOne(sel.dataset.id!, sel.value); };
  for (const b of app.querySelectorAll<HTMLButtonElement>(".act-multi")) b.onclick = () => { const sel = app.querySelector<HTMLSelectElement>(`.pick[data-id="${b.dataset.id}"]`); const vals = sel ? [...sel.selectedOptions].map((o) => o.value).filter(Boolean) : []; if (vals.length) void fillOne(b.dataset.id!, vals); };
  for (const b of app.querySelectorAll<HTMLButtonElement>(".act")) b.onclick = () => void fillOne(b.dataset.id!, true);
  for (const b of app.querySelectorAll<HTMLButtonElement>(".act-txt")) b.onclick = () => { const t = app.querySelector<HTMLInputElement>(`.txt[data-id="${b.dataset.id}"]`); if (t?.value.trim()) void fillOne(b.dataset.id!, t.value.trim()); };
  for (const t of app.querySelectorAll<HTMLInputElement>("input.txt")) t.onkeydown = (e) => { if (e.key === "Enter" && t.value.trim()) void fillOne(t.dataset.id!, t.value.trim()); };
  for (const b of app.querySelectorAll<HTMLButtonElement>(".list")) b.onclick = () => void listOptions(b.dataset.id!);
  for (const c of app.querySelectorAll<HTMLInputElement>(".rem")) c.onchange = () => { const r = rowOf(c.dataset.id!); if (r) r.remember = c.checked; };
  animateBar();
  for (const img of app.querySelectorAll<HTMLImageElement>(".clogo img")) img.onerror = () => { const d = img.parentElement!; d.style.background = "var(--ink)"; d.style.color = "#fff"; d.style.fontWeight = "800"; d.textContent = img.dataset.fallback ?? "•"; };
  document.getElementById("score")?.addEventListener("click", doScore);
  document.getElementById("tailor")?.addEventListener("click", doTailor);
  document.getElementById("letter")?.addEventListener("click", doLetter);
}

async function loadFiles() {
  state.resume = null; state.letter = null;
  try { const r = await api.file("resume", state.job?.id); if (r) state.resume = { kind: "resume", name: r.name, type: r.type, origin: r.kind, bytes: r.bytes }; } catch { /* none */ }
  if (state.job?.coverLetter) { try { const l = await api.file("letter", state.job.id); if (l) state.letter = { kind: "letter", name: l.name, type: l.type, origin: l.kind, bytes: l.bytes }; } catch { /* none */ } }
  render();
}

type Msg<T> = T & { ok?: boolean; error?: string; origin?: string };
const relay = <T,>(msg: Record<string, unknown>) => chrome.runtime.sendMessage(msg) as Promise<Msg<T>>;
const rowOf = (id: string): (Row & { remember?: boolean }) | undefined => state.form?.rows.find((r) => r.f.id === id);
const setRow = (id: string, s: Row["s"], extra: { why?: string; value?: string } = {}) => { const r = rowOf(id); if (r) { r.s = s; if (extra.why !== undefined) r.why = extra.why; if (extra.value !== undefined) r.value = extra.value; } render(); };
const valueText = (v: string | string[] | boolean) => Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Yes" : "No") : v;

async function loadSaved() { try { const r = await chrome.storage.local.get("rails_answers"); state.saved = (r.rails_answers ?? {}) as typeof state.saved; } catch { state.saved = {}; } }
async function remember(label: string, v: string | string[] | boolean) { state.saved[answerKey(label)] = v; try { await chrome.storage.local.set({ rails_answers: state.saved }); } catch { /* ignore */ } }

/** Rescan the page and refresh filled/value on the rows we already have (keeps options read earlier). */
async function refreshRows() {
  const scan = await relay<{ fields?: ScannedField[] }>({ type: "rails:scan-form" });
  if (!scan?.ok || !scan.fields || !state.form) return;
  const byId = new Map(scan.fields.map((f) => [f.id, f]));
  for (const r of state.form.rows) { const f = byId.get(r.f.id); if (!f) continue; if (f.filled) { r.s = "done"; r.value = f.value; } else if (r.s === "done") r.s = r.f.conditional ? "skip" : "left"; }
  for (const f of scan.fields) if (!state.form.rows.some((r) => r.f.id === f.id)) state.form.rows.push({ f, s: f.filled ? "done" : f.conditional ? "skip" : "todo", value: f.value });
}

/** One field, from the user's pick in the checklist. */
async function fillOne(id: string, v: string | string[] | boolean) {
  const r = rowOf(id); if (!r) return;
  setRow(id, "filling");
  const res = await relay<{ results?: { id: string; ok: boolean }[] }>({ type: "rails:apply", answers: [{ field: r.f, value: v }] });
  let ok = !!res?.ok && !!res.results?.[0]?.ok;
  if (!ok) { await refreshRows(); ok = rowOf(id)?.s === "done"; } // the page may show it even when the widget gave no signal
  setRow(id, ok ? "done" : "failed", { value: ok ? valueText(v) : r.value, why: ok ? undefined : "The page did not take that. Try another option or set it on the page." });
  if (ok && r.remember) await remember(r.f.label, v);
  if (ok) await refreshRows(); render();
}

async function listOptions(id: string) {
  const r = rowOf(id); if (!r) return;
  const res = await relay<{ options?: string[]; searchable?: boolean }>({ type: "rails:options", field: r.f });
  if (res?.ok) { r.f.options = res.options ?? []; if (res.searchable) r.f.searchable = true; }
  render();
}

/** The whole flow, Jobright-style: read the form, fill by rules, apply saved answers, ask the server for the rest, show every question with its state. */
async function doFill() {
  if (!state.me || state.busy) return;
  const url = await activeTabUrl();
  state.busy = "fill"; state.status = null; state.formOpen = true; state.form = { rows: [], running: true, step: "Reading the form…", url: url ?? "" }; render();
  await loadSaved();
  const scan = await relay<{ fields?: ScannedField[]; url?: string }>({ type: "rails:scan-form", readOptions: true });
  if (scan?.error === "needs_permission") { state.busy = null; state.form = null; state.needsPermission = scan.origin ?? null; render(); return; }
  if (!scan?.ok || !scan.fields) { state.busy = null; state.form = null; state.status = scan?.error === "no_tab" ? "No active tab." : "Could not reach this page. Reload it and try again."; render(); return; }
  state.form.rows = scan.fields.map((f) => ({ f, s: f.filled ? "done" : f.conditional ? "skip" : "todo", value: f.value }));
  if (!state.form.rows.length) { state.busy = null; state.form.running = false; state.status = "No form fields on this page. Open the application form first."; render(); return; }

  // 1. rule-based pass (names, addresses, education, work auth) + file attachments
  state.form.step = "Filling your details…"; render();
  let learned: Record<string, string[]> = {};
  try { if (url) learned = (await api.learned(new URL(url).hostname)).selectors; } catch { /* optional */ }
  const files = [state.resume, state.letter].filter((x): x is NonNullable<FileInfo> => !!x).map((x) => ({ kind: x.kind, name: x.name, type: x.type, b64: b64(x.bytes) }));
  const res = await relay<{ results?: { key: string; selector: string | null; strategy: string; success: boolean }[]; leftForYou?: string[]; url?: string }>({ type: "rails:fill", values: state.me.fields, learned, files, quiet: true });
  const results = res?.results ?? [];
  try { await api.fillReport({ url: res?.url ?? url ?? "", jobId: state.job?.id, leftForYou: res?.leftForYou, fields: results }); } catch { /* best effort */ }
  await refreshRows(); render();

  // 2. answers you saved before (pronouns, EEO, how-did-you-hear, terms): never sent anywhere
  const todo = () => state.form!.rows.filter((r) => r.s === "todo" && r.f.kind !== "file");
  const fromSaved = todo().filter((r) => state.saved[answerKey(r.f.label)] !== undefined);
  if (fromSaved.length) {
    state.form.step = "Using your saved answers…"; render();
    for (const r of fromSaved) { const v = state.saved[answerKey(r.f.label)]!; r.s = "filling"; render(); const a = await relay<{ results?: { id: string; ok: boolean }[] }>({ type: "rails:apply", answers: [{ field: r.f, value: v }] }); r.s = a?.results?.[0]?.ok ? "done" : "left"; r.value = valueText(v); render(); }
  }

  // 3. the rest: the server answers from the profile, verbatim options only; EEO never leaves the panel
  const ask = todo().filter((r) => !r.f.sensitive && !r.f.legal);
  for (const r of todo().filter((r) => r.f.sensitive)) { r.s = "left"; r.why = "Yours to answer. Tick Remember and it fills next time."; }
  for (const r of todo().filter((r) => r.f.legal)) { r.s = "left"; r.why = "Read it, then tick it here or on the page."; }
  if (ask.length) {
    state.form.step = `Answering ${ask.length} question${ask.length === 1 ? "" : "s"} from your profile…`; render();
    try {
      const { answers } = await api.answers({ url: url ?? undefined, company: state.job?.company, title: state.job?.title, questions: ask.map((r) => ({ id: r.f.id, label: r.f.label, kind: r.f.kind, options: r.f.options?.slice(0, 80), required: r.f.required })) });
      for (const r of ask) {
        const a = answers.find((x) => x.id === r.f.id);
        if (!a || a.value == null) { r.s = "left"; r.why = a?.why || "Not in your profile"; render(); continue; }
        r.s = "filling"; render();
        const ap = await relay<{ results?: { id: string; ok: boolean }[] }>({ type: "rails:apply", answers: [{ field: r.f, value: a.value }] });
        if (ap?.results?.[0]?.ok) { r.s = "done"; r.value = valueText(a.value); r.why = a.why; } else { r.s = "failed"; r.why = `Suggested "${valueText(a.value)}" but the page did not take it.`; r.value = valueText(a.value); }
        render();
      }
    } catch (e) { for (const r of ask) if (r.s === "todo") { r.s = "left"; r.why = "Answer service unavailable"; } state.status = `Could not answer questions: ${String((e as Error).message)}`; }
  }
  for (const r of state.form.rows) if (r.s === "todo") r.s = "left";
  await refreshRows();
  // dropdowns we could not list during the scan: read their options now so the row shows a picker, not a text box
  const unlisted = state.form.rows.filter((r) => (r.s === "left" || r.s === "failed") && r.f.kind === "combobox" && !r.f.options?.length && !r.f.searchable).slice(0, 12);
  if (unlisted.length) { state.form.step = "Reading the remaining dropdowns…"; render(); for (const r of unlisted) { const o = await relay<{ options?: string[]; searchable?: boolean }>({ type: "rails:options", field: r.f }); if (o?.ok) { r.f.options = o.options ?? []; if (o.searchable) r.f.searchable = true; } } }
  state.form.running = false; state.form.step = ""; state.busy = null;
  const sm = summary(state.form); state.lastFill = { filled: sm.done, attempted: sm.req, left: state.form.rows.filter((r) => r.s === "left").map((r) => r.f.label) };
  render();
}

async function doScore() {
  if (!state.me || !state.tabUrl || state.busy) return;
  state.busy = "score"; state.status = null; render();
  try {
    let text: string | undefined, title: string | undefined;
    try { const scan = await chrome.runtime.sendMessage({ type: "rails:scan" }) as { ok?: boolean; text?: string; title?: string }; if (scan?.ok) { text = scan.text; title = scan.title; } } catch { /* server fetch may still work */ }
    const r = await api.score({ url: state.tabUrl, text, title });
    state.job = r.job; state.status = r.job.tagged ? null : "Saved. The score arrives when the tagger finishes (a few minutes).";
    state.busy = null; await loadFiles(); return;
  } catch (e) { state.status = String((e as Error).message).startsWith("422") ? "Could not read this posting. Allow the site (Autofill) and try again." : "Scoring failed. Try again in a moment."; }
  state.busy = null; render();
}

const lockedMsg = (m: string, fallback: string) => (m.startsWith("locked:") ? `Out of credits; refills in ${m.slice(7)}. Pro removes the limit: ${SITE}/pricing` : m.includes(":") ? m.slice(m.indexOf(":") + 1) : fallback);

async function doTailor() {
  if (!state.me || !state.job || state.busy) return;
  state.busy = "tailor"; state.status = null; render();
  try {
    const r = await api.tailor(state.job.id);
    state.job = { ...state.job, resume: r.text, resumeScore: r.coverageAfter }; state.show.resume = false;
    state.status = `Keyword fit ${r.coverageBefore}% → ${r.coverageAfter}%. Autofill attaches this PDF.`;
    try { state.me = await api.me(); } catch { /* optional */ }
    state.busy = null; await loadFiles(); return;
  } catch (e) { state.status = lockedMsg(String((e as Error).message), "Tailoring failed. Try again."); }
  state.busy = null; render();
}

async function doLetter() {
  if (!state.me || !state.job || state.busy) return;
  state.busy = "letter"; state.status = null; render();
  try {
    const r = await api.letter(state.job.id);
    state.job = { ...state.job, coverLetter: r.letter }; state.show.letter = true;
    try { state.me = await api.me(); } catch { /* optional */ }
    state.busy = null; await loadFiles(); return;
  } catch (e) { state.status = lockedMsg(String((e as Error).message), "Letter failed. Try again."); }
  state.busy = null; render();
}

async function addSkill(k: string) {
  if (!k) return;
  const evidence = prompt(`Where did you use ${k}? One line (class, project, job). This is stored as your evidence.`) ?? "";
  if (evidence === null) return;
  try { await api.addSkill(k, evidence); state.added.add(k); state.me = await api.me(); if (state.tabUrl) state.job = (await api.job(state.tabUrl)).job ?? state.job; } catch { state.status = "Could not add that skill."; }
  render();
}

async function load() {
  const token = await getToken();
  if (!token) { state.me = null; render(); return; }
  try { state.me = await api.me(); state.status = null; }
  catch (e) { state.me = null; state.status = String((e as Error).message) === "not_connected" ? null : "Finish onboarding in Rails first (upload your resume)."; render(); return; }
  const url = await activeTabUrl();
  if (url !== state.tabUrl) { state.job = null; state.lastFill = null; state.added = new Set(); state.form = null; }
  state.tabUrl = url;
  render();
  if (state.tabUrl && /^https?:/.test(state.tabUrl)) { try { state.job = (await api.job(state.tabUrl)).job; } catch { state.job = null; } }
  await loadFiles();
}

chrome.storage.onChanged.addListener((c) => { if (c.rails_token) load(); });
chrome.tabs.onActivated.addListener(() => load());
chrome.tabs.onUpdated.addListener((_id, info) => { if (info.status === "complete") load(); });
load();
