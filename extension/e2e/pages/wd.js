/* Workday-like widgets, built to match the real DOM contract: formField wrappers, portal listboxes
   (position:fixed, appended to body), promptOption items, chip-based multiselects. */
(function () {
  const $ = (h) => { const d = document.createElement("div"); d.innerHTML = h.trim(); return d.firstElementChild; };
  let openPortal = null;
  function closePortal() { if (openPortal) { openPortal.remove(); openPortal = null; } }
  document.addEventListener("mousedown", (e) => { if (openPortal && !openPortal.contains(e.target) && !e.target.closest("[aria-haspopup='listbox']")) closePortal(); });

  function field(name, label, required, innerHtml) {
    const w = $(`<div class="formField" data-automation-id="formField-${name}">
      <div class="labelRow"><label id="lbl-${name}">${label}${required ? "*" : ""}</label></div>
      <div class="ctrlRow"><div class="ctrlInner">${innerHtml}</div></div>
    </div>`);
    return w;
  }

  window.WD = {
    text(name, label, { required = true, value = "" } = {}) {
      return field(name, label, required, `<input data-automation-id="${name}" value="${value}">`);
    },
    textById(name, label, { required = true, value = "" } = {}) { return this.text(name, label, { required, value }); },

    /** Dropdown: button + portal list appended to body, fixed position, promptOption items. */
    dropdown(name, label, options, { required = true, value = "", typeAheadOnly = false } = {}) {
      const w = field(name, label, required, `<button type="button" data-automation-id="${name}" aria-haspopup="listbox" aria-expanded="false">${value || "Select One"}</button>`);
      const btn = w.querySelector("button");
      let typed = "", typedTimer = null;
      const choose = (t) => { btn.textContent = t; btn.setAttribute("aria-expanded", "false"); closePortal(); };
      const open = () => {
        closePortal();
        const p = $(`<div class="wd-popup" style="position:fixed;top:120px;left:40px;z-index:9999"><ul data-automation-id="activeListContainer" role="listbox" id="lb-${name}"></ul></div>`);
        const ul = p.querySelector("ul");
        // a virtualized list renders nothing until typed into
        if (!typeAheadOnly) for (const o of options) { const li = $(`<li role="option" data-automation-id="promptOption" tabindex="-1">${o}</li>`); li.addEventListener("click", () => choose(o)); ul.appendChild(li); }
        document.body.appendChild(p);
        openPortal = p; btn.setAttribute("aria-controls", `lb-${name}`); btn.setAttribute("aria-expanded", "true");
        btn.focus();
      };
      btn.addEventListener("click", () => { btn.getAttribute("aria-expanded") === "true" ? (btn.setAttribute("aria-expanded", "false"), closePortal()) : open(); });
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { btn.setAttribute("aria-expanded", "false"); return closePortal(); }
        if (e.key === "Enter") {
          if (btn.getAttribute("aria-expanded") !== "true") return open();
          const hit = options.find((o) => o.toLowerCase().startsWith(typed.toLowerCase()));
          if (typed && hit) choose(hit);
          return;
        }
        if (e.key.length === 1) {
          typed += e.key; clearTimeout(typedTimer); typedTimer = setTimeout(() => (typed = ""), 1000);
          if (btn.getAttribute("aria-expanded") === "true" && openPortal) {
            const ul = openPortal.querySelector("ul"); ul.innerHTML = "";
            for (const o of options.filter((x) => x.toLowerCase().includes(typed.toLowerCase()))) { const li = $(`<li role="option" data-automation-id="promptOption">${o}</li>`); li.addEventListener("click", () => choose(o)); ul.appendChild(li); }
          }
        }
      });
      return w;
    },

    /** Multi-select search prompt: Enter searches, Enter/click accepts, result becomes a chip. */
    prompt(name, label, results, { required = true, multi = true, selected = [] } = {}) {
      const w = field(name, label, required, `<div class="msContainer" data-automation-id="multiSelectContainer"><ul data-automation-id="selectedItemList"></ul><input data-automation-id="searchBox" autocomplete="off"><span class="count"></span></div>`);
      const input = w.querySelector("input"); const list = w.querySelector("[data-automation-id=selectedItemList]"); const count = w.querySelector(".count");
      const sync = () => { const n = list.children.length; count.textContent = n ? `${n} item${n > 1 ? "s" : ""} selected` : "0 items selected"; };
      const add = (t) => {
        if (!multi) list.innerHTML = "";
        const li = $(`<li data-automation-id="selectedItem">${t}</li>`); list.appendChild(li);
        input.value = ""; searched = false; closePortal(); sync();
      };
      let searched = false;
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") { searched = false; return; }
        if (!searched) {
          searched = true; closePortal();
          const hits = results.filter((r) => r.toLowerCase().includes(input.value.toLowerCase()));
          const p = $(`<div class="wd-popup" style="position:fixed;top:160px;left:40px;z-index:9999"><ul role="listbox"></ul></div>`);
          const ul = p.querySelector("ul");
          for (const h of hits) { const li = $(`<li role="option" data-automation-id="promptOption">${h}</li>`); li.addEventListener("click", () => add(h)); ul.appendChild(li); }
          document.body.appendChild(p); openPortal = p;
        } else {
          const first = openPortal && openPortal.querySelector("li"); if (first) add(first.textContent);
        }
      });
      for (const s of selected) add(s);
      sync();
      return w;
    },

    radioGroup(name, label, options, { required = true } = {}) {
      const w = field(name, label, required, `<div data-automation-id="${name}" role="radiogroup">${options.map((o, i) => `<label class="radio"><input type="radio" name="${name}" id="${i}" value="${o}">${o}</label>`).join("")}</div>`);
      return w;
    },
    checkboxes(name, label, options, { required = true } = {}) {
      return field(name, label, required, `<div data-automation-id="${name}">${options.map((o, i) => `<label class="cb"><input type="checkbox" name="${name}[]" id="${name}-${i}" value="${o}">${o}</label>`).join("")}</div>`);
    },
    checkbox(name, label) {
      return field(name, label, false, `<label class="cb"><input type="checkbox" data-automation-id="${name}"> ${label}</label>`);
    },
    dateField(name, label, { required = true } = {}) {
      return field(name, label, required, `<div class="dateWrap"><input data-automation-id="dateSectionMonth-input" role="spinbutton" aria-label="Month" placeholder="MM"><span>/</span><input data-automation-id="dateSectionYear-input" role="spinbutton" aria-label="Year" placeholder="YYYY"></div>`);
    },
    page(marker, title, fields) {
      const p = $(`<div data-automation-id="${marker}"><h2 data-automation-id="pageHeaderTitle">${title}</h2><p>* Indicates a required field</p><div class="fields"></div></div>`);
      const host = p.querySelector(".fields");
      for (const f of fields) host.appendChild(f);
      document.body.appendChild(p);
      const nav = $(`<div class="nav"><button type="button" data-automation-id="bottom-navigation-next-button">Save and Continue</button></div>`);
      document.body.appendChild(nav);
      return p;
    },
    section(sectionId, rowPrefix, rowHtml) {
      const sec = $(`<div data-automation-id="${sectionId}"><h3>${sectionId}</h3><div class="rows"></div><button type="button" data-automation-id="add-button">Add</button></div>`);
      const rows = sec.querySelector(".rows"); const add = sec.querySelector("button");
      add.addEventListener("click", () => {
        const n = rows.children.length + 1;
        const row = $(`<div data-automation-id="${rowPrefix}-${n}">${rowHtml(n)}</div>`);
        rows.appendChild(row);
        add.setAttribute("data-automation-id", "Add Another"); add.textContent = "Add Another";
      });
      document.body.appendChild(sec);
      return sec;
    },
  };
})();
