/** One reliable way to drive a "button that opens a list" widget (Workday, MUI, Radix, headlessui).
 *  Two things made this unreliable before: a list left open from the previous field was read as if it belonged to the next
 *  one, and long lists are virtualized so the option is not in the DOM until you type. Both are handled here. */
import { clean, sleep, clickLike, mouse, typeKeys, pressKey } from "./fill";

const norm = (s: string | null | undefined) => clean(s).toLowerCase();
export const optionMatches = (t: string, w: string) => {
  const a = norm(t), b = norm(w); if (!a || !b) return false;
  return a === b || a.startsWith(b) || (b.length > 3 && a.includes(b)) || (a.length > 3 && b.startsWith(a)) || (/^(yes|no)$/.test(b) && new RegExp(`^${b}\\b`).test(a));
};
const SEL = '[role="listbox"] [role="option"], ul[role="listbox"] li, [data-automation-id="promptOption"], [data-automation-id="activeListContainer"] [role="option"], [data-automation-id="menuItem"]';

/** Every option currently on screen, ignoring Rails' own UI. Scoped to the list the button owns when it says which. */
export function openOptions(btn?: Element | null): HTMLElement[] {
  const id = btn?.getAttribute("aria-controls") ?? btn?.getAttribute("aria-owns");
  const owned = id ? document.getElementById(id) : null;
  const scope: ParentNode = owned ?? document;
  // NB: offsetParent is null for position:fixed portals (which is how these lists render), so visibility is judged by the
  // attributes instead — the earlier offsetParent check silently discarded every option on real pages.
  return [...scope.querySelectorAll<HTMLElement>(owned ? '[role="option"], li' : SEL)]
    .filter((o) => !o.closest("#rails-drawer-host") && !o.hasAttribute("hidden") && o.getAttribute("aria-hidden") !== "true" && !o.closest('[aria-hidden="true"], [hidden]'));
}

/** Close whatever list is open, so the next field does not read this one's options. */
export async function closeLists() {
  if (!openOptions().length) return;
  pressKey(document.activeElement ?? document.body, "Escape");
  mouse("mousedown", document.body); mouse("mouseup", document.body);
  await sleep(120);
  if (openOptions().length) { document.body.click(); await sleep(120); }
}

export const shownText = (btn: Element) => clean(btn.textContent);
const scrollTo = (el: Element, block: ScrollLogicalPosition) => { try { el.scrollIntoView({ block }); } catch { /* jsdom */ } };
const isPlaceholder = (t: string) => !t || /^(select one|select\.\.\.|select|choose|please select|-+|search)$/i.test(t);

/** Pick `want` from the list `btn` opens. Returns true only when the button shows it afterwards.
 *  Two paths, because Workday uses both: click the option when it is rendered, otherwise type and press Enter
 *  (long lists are virtualized and render nothing until you type). The wait before falling back is short on
 *  purpose — a list that has not appeared in under a second is not going to. */
export async function pickFromListbox(btn: HTMLElement, want: string, opts: { budgetMs?: number } = {}): Promise<boolean> {
  const settled = () => optionMatches(shownText(btn), want) && !isPlaceholder(shownText(btn));
  if (settled()) return true;
  const openWait = Math.min(opts.budgetMs ?? 1000, 1200);
  for (let attempt = 0; attempt < 2; attempt++) {
    await closeLists();
    scrollTo(btn, "center");
    btn.focus(); clickLike(btn);
    const t0 = Date.now();
    while (Date.now() - t0 < openWait && !openOptions(btn).length) await sleep(80);

    let list = openOptions(btn);
    if (list.length) {
      let hit = list.find((o) => norm(o.textContent) === norm(want)) ?? list.find((o) => optionMatches(o.textContent ?? "", want));
      if (!hit) {
        typeKeys(target(btn), want.slice(0, 12)); await sleep(350);
        list = openOptions(btn);
        hit = list.find((o) => norm(o.textContent) === norm(want)) ?? list.find((o) => optionMatches(o.textContent ?? "", want));
      }
      if (hit) {
        scrollTo(hit, "nearest"); clickLike(hit); await sleep(180);
        if (settled()) return true;
        pressKey(hit, "Enter"); await sleep(220);
        if (settled()) return true;
      }
    }

    // keyboard path: works whether or not anything rendered
    typeKeys(target(btn), want.slice(0, 20)); await sleep(300);
    pressKey(target(btn), "Enter"); await sleep(250);
    if (settled()) return true;
    await closeLists();
  }
  return false;
}
const target = (btn: HTMLElement) => (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : btn);

/** The choices this widget offers, read once and left closed. */
export async function readListbox(btn: HTMLElement, budgetMs = 1500): Promise<string[]> {
  await closeLists();
  btn.focus(); clickLike(btn);
  const t0 = Date.now(); let opts: HTMLElement[] = [];
  while (Date.now() - t0 < budgetMs) { await sleep(100); opts = openOptions(btn); if (opts.length) break; }
  if (!opts.length) { pressKey(btn, "Enter"); await sleep(250); opts = openOptions(btn); }
  const out = opts.map((o) => clean(o.textContent)).filter((t) => t && !/^(loading|no options|type to search|start typing)/i.test(t));
  await closeLists();
  return out.slice(0, 120);
}
