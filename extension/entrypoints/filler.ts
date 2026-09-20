import { fillForm, atsOf, type Values, type FillResult } from "../lib/fill";

/** Unlisted script, injected on demand (scripting.executeScript) after the user grants the site. Fills; never submits. */
export default defineUnlistedScript(() => {
  if ((window as unknown as { __railsFill?: boolean }).__railsFill) return;
  (window as unknown as { __railsFill?: boolean }).__railsFill = true;
  chrome.runtime.onMessage.addListener((msg, _s, send) => {
    if (msg?.type === "rails:scan") {
      const n = document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select").length;
      send({ ok: true, inputs: n, ats: atsOf(location.hostname), url: location.href, title: document.title, text: document.body.innerText.slice(0, 20000) });
      return true;
    }
    if (msg?.type === "rails:fill") {
      (async () => {
        const values = msg.values as Values;
        const ats = atsOf(location.hostname);
        const roots: (Document | ShadowRoot)[] = [document];
        for (const el of document.querySelectorAll("*")) if (el.shadowRoot) roots.push(el.shadowRoot);
        for (const f of document.querySelectorAll("iframe")) { try { const d = f.contentDocument; if (d) roots.push(d); } catch { /* cross-origin */ } }
        let results: FillResult[] = []; let left: string[] = [];
        for (const r of roots) { const rep = await fillForm(r, values, { ats, learned: msg.learned }); results = results.concat(rep.results); left = left.concat(rep.leftForYou); }
        left = [...new Set(left)].slice(0, 10);
        showOverlay(results.filter((r) => r.success).length, results.length, left);
        send({ ok: true, results, leftForYou: left, url: location.href });
      })();
      return true;
    }
    return false;
  });
});

function showOverlay(filled: number, attempted: number, left: string[]) {
  document.getElementById("rails-overlay")?.remove();
  const d = document.createElement("div");
  d.id = "rails-overlay";
  d.setAttribute("style", "position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#0B1B3A;color:#fff;font:600 13px/1.4 -apple-system,Segoe UI,sans-serif;padding:12px 14px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:340px");
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
  d.innerHTML = `<div style="font-weight:800;font-size:14px">Rails filled ${filled} field${filled === 1 ? "" : "s"}${attempted > filled ? ` (${attempted - filled} to check)` : ""}</div>
    ${left.length ? `<div style="opacity:.85;margin-top:6px">Left for you:</div><ul style="margin:4px 0 0 16px;padding:0;opacity:.85;font-weight:500">${left.map((l) => `<li>${esc(l.slice(0, 70))}</li>`).join("")}</ul>` : ""}
    <div style="opacity:.8;margin-top:6px">Review every field, then click the site's own Submit. Rails never submits for you.</div>
    <button id="rails-overlay-x" style="margin-top:8px;background:#FF8A3D;color:#0B1B3A;border:0;border-radius:999px;padding:6px 12px;font-weight:800;cursor:pointer">Got it</button>`;
  document.body.appendChild(d);
  d.querySelector("#rails-overlay-x")?.addEventListener("click", () => d.remove());
  setTimeout(() => d.remove(), 30000);
}
