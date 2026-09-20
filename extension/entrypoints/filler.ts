import { fillForm, atsOf, type Values, type FillResult } from "../lib/fill";

/** Unlisted script, injected on demand (scripting.executeScript) after the user grants the site. Fills; never submits. */
export default defineUnlistedScript(() => {
    if ((window as unknown as { __railsFill?: boolean }).__railsFill) return;
    (window as unknown as { __railsFill?: boolean }).__railsFill = true;
    chrome.runtime.onMessage.addListener((msg, _s, send) => {
      if (msg?.type === "rails:scan") {
        const n = document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select").length;
        send({ ok: true, inputs: n, ats: atsOf(location.hostname), url: location.href });
        return true;
      }
      if (msg?.type === "rails:fill") {
        const values = msg.values as Values;
        const roots: (Document | ShadowRoot)[] = [document];
        for (const el of document.querySelectorAll("*")) if (el.shadowRoot) roots.push(el.shadowRoot);
        let results: FillResult[] = [];
        for (const r of roots) results = results.concat(fillForm(r, values, { ats: atsOf(location.hostname), learned: msg.learned }));
        // same-origin iframes (iCIMS embeds its form)
        for (const f of document.querySelectorAll("iframe")) { try { const d = f.contentDocument; if (d) results = results.concat(fillForm(d, values, { ats: atsOf(location.hostname), learned: msg.learned })); } catch { /* cross-origin */ } }
        showOverlay(results.filter((r) => r.success).length, results.length);
        send({ ok: true, results, url: location.href });
        return true;
      }
      return false;
    });
});

function showOverlay(filled: number, attempted: number) {
  document.getElementById("rails-overlay")?.remove();
  const d = document.createElement("div");
  d.id = "rails-overlay";
  d.setAttribute("style", "position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#0B1B3A;color:#fff;font:600 13px/1.4 -apple-system,Segoe UI,sans-serif;padding:12px 14px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:320px");
  d.innerHTML = `<div style="font-weight:800;font-size:14px">Rails filled ${filled} field${filled === 1 ? "" : "s"}${attempted > filled ? ` (${attempted - filled} to check)` : ""}</div><div style="opacity:.8;margin-top:4px">Review every field, attach your resume, then click the site's own Submit. Rails never submits for you.</div><button id="rails-overlay-x" style="margin-top:8px;background:#FF8A3D;color:#0B1B3A;border:0;border-radius:999px;padding:6px 12px;font-weight:800;cursor:pointer">Got it</button>`;
  document.body.appendChild(d);
  d.querySelector("#rails-overlay-x")?.addEventListener("click", () => d.remove());
  setTimeout(() => d.remove(), 20000);
}
