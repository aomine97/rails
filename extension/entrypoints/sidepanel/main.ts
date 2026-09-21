import { api, getToken, setToken, SITE, type JobInfo, type Me } from "../../lib/api";
import { ring, meter, logo, bandLabel, BAND, bandOf, levelLabel, logoUrl } from "../../lib/ui";
import { renderForm, answerKey, summary, type FormState, type Row } from "../../lib/form";
import type { ScannedField } from "../../lib/scan";

const app = document.getElementById("app")!;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const b64 = (buf: ArrayBuffer) => { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };

type FileInfo = { kind: "resume" | "letter"; name: string; type: string; origin: string; bytes: ArrayBuffer } | null;
type State = { me: Me | null; job: JobInfo | null; tabUrl: string | null; status: string | null; needsPermission: string | null; lastFill: { filled: number; attempted: number; left: string[] } | null; busy: "score" | "tailor" | "letter" | "fill" | null; show: { resume: boolean; letter: boolean; fields: boolean; diff: boolean }; resume: FileInfo; letter: FileInfo; added: Set<string>; forms: Map<number, FormState>; tabId: number | null; formOpen: boolean; saved: Record<string, string | string[] | boolean> };
const state: State = { me: null, job: null, tabUrl: null, status: null, needsPermission: null, lastFill: null, busy: null, show: { resume: false, letter: false, fields: false, diff: true }, resume: null, letter: null, added: new Set(), forms: new Map(), tabId: null, formOpen: true, saved: {} };

async function activeTab(): Promise<{ id: number | null; url: string | null }> { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); return { id: tab?.id ?? null, url: tab?.url ?? null }; }
async function activeTabUrl(): Promise<string | null> { return (await activeTab()).url; }
/** The checklist for the tab the panel is looking at. A run keeps going on its own tab while you look at another. */
const currentForm = (): FormState | null => (state.tabId != null ? state.forms.get(state.tabId) ?? null : null);

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
    app.innerHTML = `<div class="card"><div class="top" style="padding:0 0 8px"><span class="wordmark">${logo(26)} Rails</span><span class="plan">Not connected</span></div>
      <p>Connect once and the panel shows your fit for the job on this tab and fills applications from your profile.</p>
      <button class="btn primary" id="connect">Connect to Rails</button>
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

  const ago = (iso: string | null | undefined) => { if (!iso) return null; const d = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)); return d === 0 ? "Posted today" : d === 1 ? "Posted yesterday" : d < 7 ? `Posted ${d} days ago` : d < 30 ? `Posted ${Math.round(d / 7)} week${Math.round(d / 7) === 1 ? "" : "s"} ago` : `Posted ${Math.round(d / 30)} month${Math.round(d / 30) === 1 ? "" : "s"} ago`; };
  const src = job?.source ? ({ greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", smartrecruiters: "SmartRecruiters", workday: "Workday", usajobs: "USAJobs", workable: "Workable", jobvite: "Jobvite", icims: "iCIMS", oracle: "Oracle", ext: "Your paste" } as Record<string, string>)[job.source] ?? job.source : null;
  const meAvatar = (me.name ?? me.email).split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  app.innerHTML = `
    <div class="top"><span class="wordmark">${logo(26)} Rails</span><span class="plan"><span class="avatar">${esc(meAvatar)}</span>${me.plan === "free" ? `Free <span class="credits">· ${me.credits} credits</span>` : esc(me.plan === "pro" ? "Pro" : me.plan === "semester" ? "Semester Pass" : String(me.plan))}</span></div>

    ${job ? `<div class="card">
      <div class="job-head">${companyLogo(job, initials)}<div style="min-width:0"><div class="job-co">${esc(job.company)}</div><div class="job-sub">${[job.level ? levelLabel(job.level) : null, job.field ? esc(job.field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())) : null].filter(Boolean).join(" · ")}</div></div>
        <div class="fitpill">${ring(job.fit, 56, { label: "Fit", suffix: "", stroke: 5 })}<span class="grade" style="color:${BAND[bandOf(job.fit)]}">${job.fit == null ? "UNSCORED" : bandLabel(job.fit)}</span></div></div>
      <div class="job-title">${esc(job.title)}</div>
      <div class="job-meta">${[ago(job.postedAt), job.location ? esc(job.location) : job.remote ? "Remote" : null, job.pay ? `<b>${esc(job.pay)}</b>` : null, src ? `via ${esc(src)}` : null].filter(Boolean).join("<span>·</span>")}</div>
      <div class="meters">${job.sub ? [meter("Skills", job.sub.skills), meter("Experience", job.sub.experience), meter("Field", job.sub.field)].join("") : `<span class="note">Score arrives when the tagger finishes (a few minutes).</span>`}</div>
      ${job.hardBlocks.length ? `<div class="chips">${job.hardBlocks.map((b) => `<span class="chip" style="background:var(--red-bg);color:var(--red)">✗ ${esc(b)}</span>`).join("")}</div>` : ""}
      ${(job.softNotes ?? []).length ? `<div class="chips">${job.softNotes!.map((b) => `<span class="chip" style="background:var(--amber-bg);color:var(--amber)">! ${esc(b)}</span>`).join("")}</div>` : ""}
      <div class="row" style="margin-top:10px;justify-content:space-between"><a class="link" href="${esc(job.detailUrl)}" target="_blank">Open in Rails ↗</a>${job.stage ? `<span class="chip" style="background:var(--light);color:var(--ink)">${esc(job.stage)}</span>` : ""}</div>
    </div>` : `<div class="card"><h2>This page</h2><div class="muted">${state.tabUrl ? "Not a job Rails knows yet. Score it here and it joins your feed; autofill works either way." : "Open a job posting or application form."}</div>${state.tabUrl && /^https?:/.test(state.tabUrl) ? `<button class="btn secondary" style="margin-top:10px" id="score" ${busy ? "disabled" : ""}>${busy === "score" ? "Scoring… (about 15 s)" : "Score this job"}</button>` : ""}</div>`}

    ${state.needsPermission ? `<div class="card"><p>Rails needs permission to read and fill forms on <b>${esc(new URL(state.needsPermission).hostname)}</b>. Nothing leaves the page except which fields were filled.</p><button class="btn primary" id="grant">Allow on this site</button></div>`
      : `<button class="btn primary" id="fill" ${busy ? "disabled" : ""}>${currentForm()?.running ? esc(currentForm()!.step) : currentForm() ? "Autofill again" : "Autofill this page"}</button>`}
    ${currentForm() ? renderForm(currentForm()!, state.formOpen) : ""}
    ${state.status ? `<p class="note" style="margin:-4px 2px 0">${esc(state.status)}</p>` : ""}

    <div class="card" style="padding:0">
      <div class="sect"><div class="sect-head" id="row-info"><span class="t">Your autofill information</span><span class="r">${ring(comp.pct, 28, { suffix: "", label: "Complete", stroke: 4, color: comp.pct === 100 ? "var(--green-2)" : comp.pct >= 70 ? "var(--amber)" : "var(--red)" })}<span class="chev">${state.show.fields ? "▾" : "▸"}</span></span></div>
      ${state.show.fields ? `<div style="padding-top:10px">${comp.missing.length ? `<p class="note" style="margin:0 0 6px">Missing: ${esc(comp.missing.join(", "))}. <a href="${SITE}/onboarding/confirm" target="_blank">Edit profile ↗</a></p>` : ""}<ul>${fields.filter(([, v]) => v).map(([k, v]) => `<li class="field"><div><div class="k">${esc(k)}</div><div class="v" title="${esc(v)}">${esc(v)}</div></div><button class="copy" data-v="${esc(v)}">Copy</button></li>`).join("")}</ul></div>` : ""}</div>

      <div class="sect">
        <div class="sect-head" style="cursor:default"><span class="t">Resume</span><span class="r">${state.resume ? `${state.resume.origin === "tailored" ? "Tailored for this job" : "Your upload"}: ${esc(state.resume.name)}` : "No resume on file"}</span></div>
        ${job && !job.resume && state.show.diff && (kw || titleLine) ? `<div class="diff">
          <div class="h">SEE YOUR DIFFERENCE</div>
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

      <div class="sect">
        <div class="sect-head" style="cursor:default"><span class="t">Cover letter</span><span class="r">${job?.coverLetter ? "Ready, attached when the form asks" : "Only if the form asks"}</span></div>
        <div class="row" style="margin-top:8px">
          ${job ? (job.coverLetter ? `<button class="btn ghost" id="toggle-letter">${state.show.letter ? "Hide" : "View"}</button><button class="btn ghost" id="copy-letter">Copy text</button>` : `<button class="btn ghost" id="letter" ${busy || !job.tagged ? "disabled" : ""}>${busy === "letter" ? "Writing… (about 15 s)" : `✦ Generate cover letter${me.plan === "free" ? " · 1 credit" : ""}`}</button>`) : ""}
        </div>
        ${job?.coverLetter && state.show.letter ? `<pre>${esc(job.coverLetter)}</pre>` : ""}
      </div>
    </div>
    <div class="footer"><a class="link" href="${SITE}/app" target="_blank">Open Rails</a><button class="btn ghost sm" id="disconnect">Disconnect</button></div>`;

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
  // adopt a run already going on in this tab
  const tab = await activeTab(); if (tab.id != null) { const st = await relay<{ form?: FormState | null }>({ type: "rails:get-state" }, tab.id).catch(() => null); if (st?.form) state.forms.set(tab.id, { ...st.form, tabId: tab.id }); render(); }
}

type Msg<T> = T & { ok?: boolean; error?: string; origin?: string };
const relay = <T,>(msg: Record<string, unknown>, tabId?: number | null) => chrome.runtime.sendMessage({ ...msg, tabId: tabId ?? undefined }) as Promise<Msg<T>>;
const rowOf = (id: string, fs: FormState | null = currentForm()): (Row & { remember?: boolean }) | undefined => fs?.rows.find((r) => r.f.id === id);

/** One field from a pick in the panel: the page does the work and reports back through rails:state. */
async function fillOne(id: string, v: string | string[] | boolean) {
  const fs = currentForm(); if (!fs) return;
  await relay({ type: "rails:fill-one", id, value: v }, fs.tabId);
}
async function listOptions(id: string) { const fs = currentForm(); if (!fs) return; await relay({ type: "rails:fill-one", id, value: "", list: true }, fs.tabId); }

/** Start the run inside the page. The page owns it from here: it keeps going if this panel closes or the tab changes; we only mirror its state. */
async function doFill() {
  if (!state.me || state.busy) return;
  const tab = await activeTab(); if (tab.id == null) { state.status = "No active tab."; render(); return; }
  state.busy = "fill"; state.status = null; state.formOpen = true; render();
  const res = await relay({ type: "rails:run" }, tab.id);
  state.busy = null;
  if (res?.error === "needs_permission") { state.needsPermission = res.origin ?? null; render(); return; }
  if (res?.error) { state.status = res.error === "no_tab" ? "No active tab." : "Could not reach this page. Reload it and try again."; render(); return; }
  state.status = "Running inside the page. You can switch tabs; it keeps going."; render();
}

// The page reports every step; keep the panel's checklist in sync with the tab it belongs to.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "rails:state" && sender.tab?.id != null) {
    if (msg.form) state.forms.set(sender.tab.id, { ...(msg.form as FormState), tabId: sender.tab.id });
    if (msg.job && sender.tab.id === state.tabId) state.job = msg.job as JobInfo;
    if (sender.tab.id === state.tabId) render();
  }
});

async function doScore() {
  if (!state.me || !state.tabUrl || state.busy) return;
  state.busy = "score"; state.status = null; render();
  try {
    let text: string | undefined, title: string | undefined;
    let company: string | undefined;
    try { const scan = await relay<{ text?: string; title?: string; company?: string | null }>({ type: "rails:scan" }); if (scan?.ok) { text = scan.text; title = scan.title; company = scan.company ?? undefined; } } catch { /* server fetch may still work */ }
    const r = await api.score({ url: state.tabUrl, text, title, company });
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
  const tab = await activeTab(); const url = tab.url;
  if (url !== state.tabUrl) { state.job = null; state.lastFill = null; state.added = new Set(); }
  if (tab.id != null && state.forms.get(tab.id) && state.forms.get(tab.id)!.url.split("#")[0] !== (url ?? "").split("#")[0] && !state.forms.get(tab.id)!.running) state.forms.delete(tab.id); // the tab moved to another page
  state.tabId = tab.id; state.tabUrl = url;
  const elsewhere = [...state.forms.values()].find((f) => f.running && f.tabId !== tab.id);
  state.status = elsewhere ? `Still filling ${(() => { try { return new URL(elsewhere.url).hostname; } catch { return "the other tab"; } })()} in the background.` : state.status;
  render();
  if (state.tabUrl && /^https?:/.test(state.tabUrl)) { try { state.job = (await api.job(state.tabUrl)).job; } catch { state.job = null; } }
  await loadFiles();
}

chrome.storage.onChanged.addListener((c) => { if (c.rails_token) load(); });
chrome.tabs.onActivated.addListener(() => load());
chrome.tabs.onUpdated.addListener((_id, info) => { if (info.status === "complete") load(); });
load();
