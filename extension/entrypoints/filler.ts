import { fillForm, atsOf, attachFile, type Values, type FillResult } from "../lib/fill";
import { scanFields, readComboOptions, applyAnswer, type ScannedField } from "../lib/scan";

function allRoots(): (Document | ShadowRoot)[] {
  const roots: (Document | ShadowRoot)[] = [document];
  for (const el of document.querySelectorAll("*")) if (el.shadowRoot) roots.push(el.shadowRoot);
  for (const f of document.querySelectorAll("iframe")) { try { const d = f.contentDocument; if (d) roots.push(d); } catch { /* cross-origin */ } }
  return roots;
}

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
    if (msg?.type === "rails:scan-form") {
      (async () => {
        const fields: ScannedField[] = [];
        for (const r of allRoots()) fields.push(...scanFields(r));
        if (msg.readOptions) {
          let budget = 8; // open at most this many dropdowns per scan; the rest list on demand
          for (const f of fields) if (f.kind === "combobox" && !f.filled && budget > 0) { budget--; const r = allRoots().find((x) => x.querySelector(`[data-rails-f="${f.id}"]`)) ?? document; f.options = await readComboOptions(r, f); }
        }
        send({ ok: true, fields, url: location.href });
      })();
      return true;
    }
    if (msg?.type === "rails:options") {
      (async () => { const f = msg.field as ScannedField; const r = allRoots().find((x) => x.querySelector(`[data-rails-f="${f.id}"]`)) ?? document; const options = await readComboOptions(r, f, 2500); send({ ok: true, options, searchable: !!f.searchable }); })();
      return true;
    }
    if (msg?.type === "rails:apply") {
      (async () => {
        const out: { id: string; ok: boolean }[] = [];
        for (const a of msg.answers as { field: ScannedField; value: string | string[] | boolean }[]) {
          const r = allRoots().find((x) => x.querySelector(`[data-rails-f="${a.field.id}"]`));
          let ok = false; try { ok = r ? await applyAnswer(r, a.field, a.value) : false; } catch { ok = false; }
          out.push({ id: a.field.id, ok });
        }
        send({ ok: true, results: out });
      })();
      return true;
    }
    if (msg?.type === "rails:fill") {
      (async () => {
        const values = msg.values as Values;
        const ats = atsOf(location.hostname);
        const roots = allRoots();
        let results: FillResult[] = []; let left: string[] = [];
        for (const r of roots) { const rep = await fillForm(r, values, { ats, learned: msg.learned }); results = results.concat(rep.results); left = left.concat(rep.leftForYou); }
        // files: the panel sends base64 bytes for the resume (and letter when one exists)
        const attached: string[] = [];
        for (const f of (msg.files ?? []) as { kind: "resume" | "letter"; name: string; type: string; b64: string }[]) {
          const bin = Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0));
          const file = new File([bin], f.name, { type: f.type });
          for (const r of roots) { const a = attachFile(r, f.kind, file); if (a.success) { attached.push(f.kind === "resume" ? `Resume: ${f.name}` : `Cover letter: ${f.name}`); results.push({ key: (f.kind === "resume" ? "resumeFile" : "letterFile") as unknown as FillResult["key"], selector: a.selector, strategy: "file", success: true }); break; } }
        }
        left = [...new Set(left)].filter((l) => !(attached.length && /resume|cv\b/i.test(l) && attached.some((a) => a.startsWith("Resume"))) && !(attached.some((a) => a.startsWith("Cover")) && /cover/i.test(l))).slice(0, 10);
        if (!msg.quiet) showOverlay(results.filter((r) => r.success).length, results.length, left, attached);
        send({ ok: true, results, leftForYou: left, url: location.href });
      })();
      return true;
    }
    return false;
  });
});

function showOverlay(filled: number, attempted: number, left: string[], attached: string[] = []) {
  document.getElementById("rails-overlay")?.remove();
  const d = document.createElement("div");
  d.id = "rails-overlay";
  d.setAttribute("style", "position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#0B1B3A;color:#fff;font:600 13px/1.4 -apple-system,Segoe UI,sans-serif;padding:12px 14px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:340px");
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
  d.innerHTML = `<div style="font-weight:800;font-size:14px">Rails filled ${filled} field${filled === 1 ? "" : "s"}${attempted > filled ? ` (${attempted - filled} to check)` : ""}</div>
    ${attached.length ? `<div style="opacity:.85;margin-top:6px">Attached: ${attached.map(esc).join(", ")}</div>` : ""}
    ${left.length ? `<div style="opacity:.85;margin-top:6px">Left for you:</div><ul style="margin:4px 0 0 16px;padding:0;opacity:.85;font-weight:500">${left.map((l) => `<li>${esc(l.slice(0, 70))}</li>`).join("")}</ul>` : ""}
    <div style="opacity:.8;margin-top:6px">Review every field, then click the site's own Submit. Rails never submits for you.</div>
    <button id="rails-overlay-x" style="margin-top:8px;background:#FF8A3D;color:#0B1B3A;border:0;border-radius:999px;padding:6px 12px;font-weight:800;cursor:pointer">Got it</button>`;
  document.body.appendChild(d);
  d.querySelector("#rails-overlay-x")?.addEventListener("click", () => d.remove());
  setTimeout(() => d.remove(), 30000);
}
