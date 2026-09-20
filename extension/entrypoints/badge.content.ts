import { bandOf, BAND, logo } from "../lib/ui";

/** Floating Rails tab on job-application pages. Click opens the side panel; shows the fit once the panel has it. */
const ATS_HOSTS = [
  "*://*.greenhouse.io/*", "*://*.lever.co/*", "*://*.myworkdayjobs.com/*", "*://*.myworkdaysite.com/*", "*://*.icims.com/*", "*://*.ashbyhq.com/*",
  "*://*.smartrecruiters.com/*", "*://*.jobvite.com/*", "*://*.workable.com/*", "*://*.bamboohr.com/*", "*://*.oraclecloud.com/*", "*://*.taleo.net/*",
  "*://*.successfactors.com/*", "*://*.successfactors.eu/*", "*://*.applytojob.com/*", "*://*.breezy.hr/*", "*://*.rippling.com/*", "*://*.dover.com/*",
  "*://*.recruitee.com/*", "*://*.ultipro.com/*", "*://*.paylocity.com/*", "*://*.adp.com/*", "*://*.wd1.myworkdayjobs.com/*", "*://*.eightfold.ai/*", "*://*.phenom.com/*",
];

export default defineContentScript({
  matches: ATS_HOSTS,
  runAt: "document_idle",
  main() {
    if (window.top !== window) return; // frames get no badge
    if (document.getElementById("rails-badge-host")) return;
    if (sessionStorage.getItem("rails-badge-hidden") === "1") return;
    const host = document.createElement("div"); host.id = "rails-badge-host"; host.style.cssText = "all:initial;position:fixed;right:0;bottom:120px;z-index:2147483646";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
      :host{all:initial}
      .tab{display:flex;align-items:center;gap:8px;background:#0B1B3A;color:#fff;border-radius:12px 0 0 12px;padding:8px 10px 8px 10px;box-shadow:0 6px 20px rgba(11,27,58,.25);font:700 12px/1 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;cursor:pointer;transform:translateX(0);transition:transform .2s ease,background .2s}
      .tab:hover{background:#13255A}
      .fit{min-width:30px;height:22px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#0B1B3A;background:#E3E8F0;padding:0 6px}
      .x{opacity:.55;font-size:14px;margin-left:2px;padding:0 2px}.x:hover{opacity:1}
      .tab.mini{padding:8px 6px 8px 8px}.tab.mini .lbl,.tab.mini .fit,.tab.mini .x{display:none}
    </style>
    <div class="tab" id="tab" title="Open Rails"><span id="logo"></span><span class="lbl">Rails</span><span class="fit" id="fit" hidden>—</span><span class="x" id="x" title="Hide on this page">×</span></div>`;
    root.getElementById("logo")!.innerHTML = logo(20);
    const tab = root.getElementById("tab")!; const fit = root.getElementById("fit")!;
    tab.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).id === "x") { e.stopPropagation(); host.remove(); sessionStorage.setItem("rails-badge-hidden", "1"); return; }
      chrome.runtime.sendMessage({ type: "rails:open" }).catch(() => {});
    });
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === "rails:badge") {
        const v = msg.fit as number | null;
        fit.hidden = v == null; fit.textContent = v == null ? "—" : `${v}`;
        const b = bandOf(v); fit.style.background = b === "none" ? "#E3E8F0" : b === "green" ? "#DCFCE7" : b === "amber" ? "#FFE8CC" : "#FDECEC"; fit.style.color = BAND[b];
      }
    });
    (document.body ?? document.documentElement).appendChild(host);
    // cached score from the panel's last look at this URL, so the number shows before the panel is opened
    chrome.storage.local.get("rails_fit_cache").then((r) => { const c = (r.rails_fit_cache ?? {}) as Record<string, number>; const v = c[location.href.split("#")[0]!]; if (v != null) if (v != null) { fit.hidden = false; fit.textContent = `${v}`; const b = bandOf(v); fit.style.background = b === "green" ? "#DCFCE7" : b === "amber" ? "#FFE8CC" : "#FDECEC"; fit.style.color = BAND[b]; } }).catch(() => {});
  },
});
