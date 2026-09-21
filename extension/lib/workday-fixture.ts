/** A Workday-shaped page for tests: formField wrappers with the label two levels above the control, dropdowns whose
 *  options render in a fixed-position portal and also answer to type-ahead + Enter, search prompts that need two
 *  Enters and show a chip, split date spinbuttons, and Add-Another sections. Kept beside the adapter so a selector
 *  change has to break a test before it breaks a user. */

export function formField(name: string, label: string, inner: string): HTMLElement {
  const w = document.createElement("div");
  w.setAttribute("data-automation-id", `formField-${name}`);
  w.innerHTML = `<div class="wd-label"><label>${label}</label></div><div class="wd-control"><div>${inner}</div></div>`;
  document.body.appendChild(w);
  return w;
}

/** Dropdown: button + portal list. Clicking an option or typing-then-Enter both select. */
export function wdDropdown(name: string, label: string, options: string[]): HTMLButtonElement {
  const w = formField(name, label, `<button data-automation-id="${name}" aria-haspopup="listbox">Select One</button>`);
  const btn = w.querySelector("button")!;
  let typed = "";
  const close = () => { document.querySelector(`#portal-${name}`)?.remove(); btn.setAttribute("aria-expanded", "false"); typed = ""; };
  const choose = (t: string) => { btn.textContent = t; close(); };
  const open = () => {
    if (document.querySelector(`#portal-${name}`)) { close(); return; }
    const p = document.createElement("div");
    p.id = `portal-${name}`; p.style.position = "fixed";
    p.innerHTML = `<ul data-automation-id="activeListContainer" role="listbox" id="lb-${name}">${options.map((o) => `<li role="option" data-automation-id="promptOption">${o}</li>`).join("")}</ul>`;
    for (const li of p.querySelectorAll("li")) li.addEventListener("click", () => choose(li.textContent!));
    document.body.appendChild(p);
    btn.setAttribute("aria-controls", `lb-${name}`); btn.setAttribute("aria-expanded", "true");
  };
  btn.addEventListener("click", open);
  btn.addEventListener("keydown", (e) => {
    const k = (e as KeyboardEvent).key;
    if (k === "Escape") return close();
    if (k === "Enter") { if (!document.querySelector(`#portal-${name}`)) return open(); const hit = options.find((o) => o.toLowerCase().startsWith(typed.toLowerCase())); if (typed && hit) choose(hit); return; }
    if (k.length === 1) typed += k;
  });
  return btn;
}

/** Search prompt: first Enter searches, second Enter accepts, the pick shows as a chip. */
export function wdPrompt(name: string, label: string, results: string[], multi = false): HTMLInputElement {
  const w = formField(name, label, `<input data-automation-id="searchBox"><div class="chips"></div>`);
  const input = w.querySelector("input")!; const chipBox = w.querySelector(".chips")!;
  let searched = false;
  const add = (t: string) => {
    if (!multi) chipBox.innerHTML = "";
    const c = document.createElement("div"); c.setAttribute("data-automation-id", "selectedItem"); c.textContent = t; chipBox.appendChild(c);
    document.querySelector(`#prompt-${name}`)?.remove(); input.value = ""; searched = false;
  };
  input.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key !== "Enter") return;
    if (!searched) {
      searched = true;
      const p = document.createElement("div"); p.id = `prompt-${name}`; p.style.position = "fixed";
      const hits = results.filter((r) => r.toLowerCase().includes(input.value.toLowerCase()));
      p.innerHTML = `<ul role="listbox">${hits.map((h) => `<li role="option" data-automation-id="promptOption">${h}</li>`).join("")}</ul>`;
      for (const li of p.querySelectorAll("li")) li.addEventListener("click", () => add(li.textContent!));
      document.body.appendChild(p);
    } else {
      const first = document.querySelector(`#prompt-${name} li`); if (first) add(first.textContent!);
    }
  });
  return input;
}

export function wdDateField(name: string, label: string): HTMLElement {
  return formField(name, label, `<div><input data-automation-id="dateSectionMonth-input" role="spinbutton"><input data-automation-id="dateSectionYear-input" role="spinbutton"></div>`);
}

export function wdPage(marker: string, title: string) {
  const p = document.createElement("div"); p.setAttribute("data-automation-id", marker);
  p.innerHTML = `<h2 data-automation-id="pageHeaderTitle">${title}</h2>`;
  document.body.appendChild(p);
  const nav = document.createElement("div");
  nav.innerHTML = `<button data-automation-id="bottom-navigation-next-button">Save and Continue</button>`;
  document.body.appendChild(nav);
  return p;
}

/** A section whose Add button appends the next numbered row. */
export function wdSection(sectionId: string, rowPrefix: string, rowHtml: (n: number) => string) {
  const sec = document.createElement("div"); sec.setAttribute("data-automation-id", sectionId);
  const add = document.createElement("button"); add.setAttribute("data-automation-id", "add-button"); add.textContent = "Add";
  sec.appendChild(add); document.body.appendChild(sec);
  add.addEventListener("click", () => {
    const n = sec.querySelectorAll(`[data-automation-id^="${rowPrefix}-"]`).length + 1;
    const row = document.createElement("div"); row.setAttribute("data-automation-id", `${rowPrefix}-${n}`);
    row.innerHTML = rowHtml(n); sec.insertBefore(row, add);
    add.setAttribute("data-automation-id", "Add Another"); add.textContent = "Add Another";
  });
  return sec;
}
