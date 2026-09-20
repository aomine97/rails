import { api, getToken, setToken, SITE, type JobInfo, type Me } from "../../lib/api";

const app = document.getElementById("app")!;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const bandColor = (fit: number | null) => (fit == null ? "var(--muted)" : fit >= 85 ? "var(--green)" : fit >= 70 ? "var(--amber)" : "var(--red)");

type State = { me: Me | null; job: JobInfo | null; tabUrl: string | null; status: string | null; needsPermission: string | null; lastFill: { filled: number; attempted: number } | null };
const state: State = { me: null, job: null, tabUrl: null, status: null, needsPermission: null, lastFill: null };

async function activeTabUrl(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ?? null;
}

function render() {
  const { me, job } = state;
  if (!me) {
    app.innerHTML = `<div class="card"><div class="brand">Rails <small>not connected</small></div>
      <p>Connect once and the panel shows your fit for the job on this tab and fills applications from your profile.</p>
      <button class="btn" id="connect">Connect to Rails</button>
      <p class="note" style="margin-top:8px">Opens rails-psi.vercel.app in a tab. Sign in there if asked, then come back.</p>
      ${state.status ? `<p class="note">${esc(state.status)}</p>` : ""}</div>`;
    document.getElementById("connect")!.onclick = () => chrome.tabs.create({ url: `${SITE}/ext/connect` });
    return;
  }
  const f = me.fields;
  const fields: [string, unknown][] = [["Name", f.fullName], ["Email", f.email], ["Phone", f.phone], ["LinkedIn", f.linkedin], ["GitHub", f.github], ["Portfolio", f.portfolio], ["City", f.city], ["State", f.state], ["School", f.school], ["Degree", f.degree], ["Major", f.major], ["Grad year", f.gradYear], ["GPA", f.gpa]];
  app.innerHTML = `
    <div class="card"><div class="brand">Rails <small>${esc(me.name ?? me.email)} · ${me.plan === "free" ? `${me.credits} credits` : esc(me.plan.toUpperCase())}</small></div></div>
    ${job ? `<div class="card">
      <div class="row" style="justify-content:space-between"><div><div class="ink">${esc(job.title)}</div><div class="muted">${esc(job.company)}${job.location ? ` · ${esc(job.location)}` : ""}</div></div><div class="fit" style="color:${bandColor(job.fit)}">${job.fit ?? "—"}</div></div>
      ${job.hardBlocks.length ? `<div style="margin-top:6px">${job.hardBlocks.map((b) => `<span class="chip" style="background:var(--red-bg);color:var(--red)">✗ ${esc(b)}</span>`).join(" ")}</div>` : ""}
      ${job.requirements.length ? `<h2 style="margin-top:10px">Requirements</h2><ul>${job.requirements.slice(0, 8).map((r) => `<li class="req"><span class="dot" style="background:${r.status === "met" ? "var(--green)" : r.status === "missing" ? "var(--red)" : "var(--amber)"}"></span><span>${esc(r.text)}${r.evidence ? `<div class="muted">You bring: ${esc(r.evidence)}</div>` : ""}</span></li>`).join("")}</ul>` : ""}
      <div class="row" style="margin-top:10px"><a class="btn ghost" href="${esc(job.detailUrl)}" target="_blank">Open in Rails ↗</a>${job.resume ? `<button class="btn ghost" id="copy-resume">Copy tailored resume${job.resumeScore != null ? ` (${job.resumeScore}%)` : ""}</button>` : `<a class="btn ghost" href="${esc(job.detailUrl)}/tailor" target="_blank">Tailor resume</a>`}${job.coverLetter ? `<button class="btn ghost" id="copy-letter">Copy cover letter</button>` : ""}</div>
    </div>` : `<div class="card"><h2>This page</h2><div class="muted">${state.tabUrl ? "Not a job Rails knows yet. Autofill still works on any application form." : "Open a job posting or application form."}</div>${state.tabUrl ? `<a class="btn ghost" style="margin-top:8px" href="${SITE}/app/paste?url=${encodeURIComponent(state.tabUrl)}" target="_blank">Score it in Rails ↗</a>` : ""}</div>`}
    <div class="card">
      <h2>Autofill</h2>
      ${state.needsPermission ? `<p>Rails needs permission to read and fill forms on <b>${esc(new URL(state.needsPermission).hostname)}</b>. Nothing is sent anywhere except which fields were filled.</p><button class="btn" id="grant">Allow on this site</button>` : `<button class="btn" id="fill">Fill this page from my profile</button>`}
      ${state.lastFill ? `<p class="note">Filled ${state.lastFill.filled} of ${state.lastFill.attempted} fields it recognized. Check them, attach your resume, then click the site's Submit.</p>` : `<p class="note">Fills name, contact, links, education and the yes/no work-authorization questions. It never clicks Submit and never uploads a file for you.</p>`}
      ${state.status ? `<p class="note">${esc(state.status)}</p>` : ""}
    </div>
    <div class="card"><h2>Copy a field</h2><ul>${fields.filter(([, v]) => v).map(([k, v]) => `<li class="field"><div><div class="k">${esc(k)}</div><div class="v" title="${esc(v)}">${esc(v)}</div></div><button class="copy" data-v="${esc(v)}">Copy</button></li>`).join("")}</ul></div>
    <div class="card row" style="justify-content:space-between"><a class="muted" href="${SITE}/app" target="_blank">Open Rails</a><button class="btn ghost" id="disconnect">Disconnect</button></div>`;
  for (const b of app.querySelectorAll<HTMLButtonElement>(".copy")) b.onclick = async () => { await navigator.clipboard.writeText(b.dataset.v ?? ""); b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1200); };
  document.getElementById("copy-resume")?.addEventListener("click", () => navigator.clipboard.writeText(job?.resume ?? ""));
  document.getElementById("copy-letter")?.addEventListener("click", () => navigator.clipboard.writeText(job?.coverLetter ?? ""));
  document.getElementById("disconnect")?.addEventListener("click", async () => { await setToken(null); state.me = null; render(); });
  document.getElementById("grant")?.addEventListener("click", async () => {
    const ok = await chrome.permissions.request({ origins: [state.needsPermission!] });
    if (ok) { state.needsPermission = null; await doFill(); } else { state.status = "Permission declined."; render(); }
  });
  document.getElementById("fill")?.addEventListener("click", doFill);
}

async function doFill() {
  if (!state.me) return;
  state.status = "Filling…"; render();
  const url = await activeTabUrl();
  let learned: Record<string, string[]> = {};
  try { if (url) learned = (await api.learned(new URL(url).hostname)).selectors; } catch { /* optional */ }
  const res = await chrome.runtime.sendMessage({ type: "rails:fill", values: state.me.fields, learned }) as { ok?: boolean; error?: string; origin?: string; results?: { key: string; selector: string | null; strategy: string; success: boolean }[]; url?: string };
  if (res?.error === "needs_permission") { state.needsPermission = res.origin ?? null; state.status = null; render(); return; }
  if (!res?.ok) { state.status = res?.error === "no_tab" ? "No active tab." : "Could not reach this page. Reload it and try again."; render(); return; }
  const results = res.results ?? [];
  state.lastFill = { filled: results.filter((r) => r.success).length, attempted: results.length }; state.status = null; render();
  try { await api.fillReport({ url: res.url ?? url ?? "", jobId: state.job?.id, fields: results }); } catch { /* telemetry is best effort */ }
}

async function load() {
  const token = await getToken();
  if (!token) { state.me = null; render(); return; }
  try { state.me = await api.me(); state.status = null; }
  catch (e) { state.me = null; state.status = String((e as Error).message) === "not_connected" ? null : "Finish onboarding in Rails first (upload your resume)."; render(); return; }
  state.tabUrl = await activeTabUrl();
  render();
  if (state.tabUrl && /^https?:/.test(state.tabUrl)) { try { state.job = (await api.job(state.tabUrl)).job; } catch { state.job = null; } render(); }
}

chrome.storage.onChanged.addListener((c) => { if (c.rails_token) load(); });
chrome.tabs.onActivated.addListener(() => load());
chrome.tabs.onUpdated.addListener((_id, info) => { if (info.status === "complete") load(); });
load();
