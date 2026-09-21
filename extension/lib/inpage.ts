/** Everything Rails puts inside a job page: the badge, the drawer, the runner. Mounted by the ATS content script or injected on demand. */
import { bandOf, BAND, logo } from "./ui";
import { mountDrawer, setOpen, isOpen, loadJob, autoScore, pageJobLd } from "./drawer";
import { atsOf } from "./fill";

export function mountRails() {
  const w = window as unknown as { __railsMounted?: boolean };
  if (w.__railsMounted || window.top !== window) return; w.__railsMounted = true;
  const openPanel = () => { chrome.runtime.sendMessage({ type: "rails:open" }).catch(() => {}); };
  mountDrawer({ openPanel });
  mountBadge();
  void loadJob().then(async (job) => {
    setFit(job?.fit ?? null);
    if (job) return;
    // A posting Rails has never seen: score it on its own so the badge shows a number without a click.
    const r = await chrome.storage.local.get("rails_autoscore").catch(() => ({} as Record<string, unknown>));
    if (r.rails_autoscore === false) return;
    const scored = await autoScore(); setFit(scored?.fit ?? null);
  });
  chrome.runtime.onMessage.addListener((msg, _s, send) => {
    if (msg?.type === "rails:scan") { const ld = pageJobLd(); send({ ok: true, ats: atsOf(location.hostname), url: location.href, title: ld?.title ?? document.title, company: ld?.company ?? null, text: document.body.innerText.slice(0, 20000) }); return false; }
    if (msg?.type === "rails:badge") { setFit(msg.fit as number | null); send({ ok: true }); return false; }
    return false;
  });
}

let fitEl: HTMLElement | null = null;
function setFit(v: number | null) {
  if (!fitEl) return;
  fitEl.hidden = v == null; fitEl.textContent = v == null ? "—" : `${v}%`;
  const b = bandOf(v); fitEl.style.background = b === "none" ? "#E3E8F0" : b === "green" ? "#DCFCE7" : b === "amber" ? "#FFE8CC" : "#FDECEC"; fitEl.style.color = BAND[b];
}

function mountBadge() {
  if (document.getElementById("rails-badge-host")) return;
  if (sessionStorage.getItem("rails-badge-hidden") === "1") return;
  const host = document.createElement("div"); host.id = "rails-badge-host"; host.style.cssText = "all:initial;position:fixed;right:0;bottom:120px;z-index:2147483645";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    :host{all:initial}
    .tab{display:flex;align-items:center;gap:8px;background:#0B1B3A;color:#fff;border-radius:12px 0 0 12px;padding:8px 10px;box-shadow:0 6px 20px rgba(11,27,58,.25);font:700 12px/1 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;cursor:pointer;transition:background .2s}
    .tab:hover{background:#13255A}
    .fit{min-width:34px;height:22px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#0B1B3A;background:#E3E8F0;padding:0 6px}
    .x{opacity:.55;font-size:14px;margin-left:2px;padding:0 2px}.x:hover{opacity:1}
  </style>
  <div class="tab" id="tab" title="Open Rails"><span id="logo"></span><span class="lbl">Rails</span><span class="fit" id="fit" hidden>—</span><span class="x" id="x" title="Hide on this page">×</span></div>`;
  root.getElementById("logo")!.innerHTML = logo(20);
  fitEl = root.getElementById("fit");
  root.getElementById("tab")!.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id === "x") { e.stopPropagation(); host.remove(); sessionStorage.setItem("rails-badge-hidden", "1"); return; }
    setOpen(!isOpen());
  });
  (document.body ?? document.documentElement).appendChild(host);
}
