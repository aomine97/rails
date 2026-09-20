// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fillForm, atsOf } from "./fill";

const values = { firstName: "Maya", lastName: "Patel", fullName: "Maya Patel", preferredName: null, email: "maya@example.edu", phone: "5715551212", phoneCountry: "United States", linkedin: "linkedin.com/in/maya", github: "github.com/maya", street: "1 Main St", city: "McLean", state: "VA", stateName: "Virginia", zip: "22101", country: "United States", school: "Northern Virginia Community College", degree: "AAS", degreeName: "Associate's Degree", major: "Information Systems Technology, Cloud Computing", disciplines: ["Information Technology", "Information Systems"], startYear: "2025", gradYear: "2027", gradMonth: "May", gpa: "3.6", needsSponsorship: false, workAuthorized: true };

/** react-select stand-in matching what Greenhouse actually does: opens on a full click of the control, options live in a listbox
 *  referenced by aria-controls, typing filters (async-style), option click selects and shows a .select__single-value. */
function reactSelect(id: string, label: string, options: string[], multi = false) {
  const wrap = document.createElement("div"); wrap.className = "select__container";
  wrap.innerHTML = `<label for="${id}">${label}</label><div class="select__control"><div class="select__value-container"><div class="select__input-container"><input id="${id}" role="combobox" aria-autocomplete="list" aria-expanded="false" class="select__input" autocomplete="off"></div></div></div>`;
  document.body.appendChild(wrap);
  const input = wrap.querySelector("input")!; const control = wrap.querySelector(".select__control")!; const vc = wrap.querySelector(".select__value-container")!;
  let menu: HTMLDivElement | null = null; let open = false; let query = "";
  const value = { textContent: "" };
  const renderMenu = () => {
    menu?.remove(); menu = document.createElement("div"); menu.className = "select__menu";
    const lb = document.createElement("div"); lb.setAttribute("role", "listbox"); lb.id = `react-select-${id}-listbox`; menu.appendChild(lb);
    for (const o of options.filter((x) => !query || x.toLowerCase().includes(query.toLowerCase()))) { const d = document.createElement("div"); d.setAttribute("role", "option"); d.className = "select__option"; d.textContent = o; d.addEventListener("click", () => { value.textContent = multi ? `${value.textContent} ${o}`.trim() : o; const sv = vc.querySelector(".select__single-value") ?? vc.appendChild(Object.assign(document.createElement("div"), { className: "select__single-value" })); sv.textContent = value.textContent; close(); }); lb.appendChild(d); }
    wrap.appendChild(menu); input.setAttribute("aria-controls", lb.id); input.setAttribute("aria-expanded", "true"); open = true;
  };
  const close = () => { menu?.remove(); menu = null; open = false; input.removeAttribute("aria-controls"); input.setAttribute("aria-expanded", "false"); query = ""; };
  control.addEventListener("click", () => (open ? close() : renderMenu()));
  input.addEventListener("input", () => { query = input.value; renderMenu(); });
  input.addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Escape") close(); });
  return { input, value };
}

describe("fillForm", () => {
  it("greenhouse: ATS selectors first", async () => {
    document.body.innerHTML = `<form><input id="first_name"><input id="last_name"><input id="email" type="email"><input id="phone"><input name="job_application[answers_attributes][0][text_value]" aria-label="LinkedIn Profile"><button type="submit">Submit</button></form>`;
    const { results } = await fillForm(document, values, { ats: "greenhouse" });
    expect((document.getElementById("first_name") as HTMLInputElement).value).toBe("Maya");
    expect(results.find((x) => x.key === "linkedin")?.strategy).toBe("label");
    expect(results.every((x) => x.success)).toBe(true);
  });
  it("lever: full name, urls, org", async () => {
    document.body.innerHTML = `<input name="name"><input name="email"><input name="phone"><input name="urls[LinkedIn]"><input name="urls[GitHub]"><input name="org">`;
    await fillForm(document, values, { ats: "lever" });
    expect((document.querySelector('input[name="name"]') as HTMLInputElement).value).toBe("Maya Patel");
    expect((document.querySelector('input[name="org"]') as HTMLInputElement).value).toBe("Northern Virginia Community College");
  });
  it("generic: labels/placeholders; keeps typed text; skips file and submit; lists what it left", async () => {
    document.body.innerHTML = `<label for="a">First Name*</label><input id="a"><label>Last Name <input id="b"></label><input autocomplete="email" id="c"><input placeholder="(555) 555-5555" id="d"><input id="e" value="already typed" name="linkedin"><label for="f">Resume/CV*</label><input type="file" id="f" name="resume"><label for="g">What are your preferred pronouns?*</label><input id="g" required><input type="submit" value="Apply">`;
    const { results, leftForYou } = await fillForm(document, values, { ats: "generic" });
    expect((document.getElementById("a") as HTMLInputElement).value).toBe("Maya");
    expect((document.getElementById("b") as HTMLInputElement).value).toBe("Patel");
    expect((document.getElementById("e") as HTMLInputElement).value).toBe("already typed");
    expect((document.getElementById("g") as HTMLInputElement).value).toBe("");
    expect(results.find((x) => x.key === "linkedin")?.strategy).toBe("name:kept");
    expect(leftForYou[0]).toMatch(/Resume/); expect(leftForYou.some((l) => /pronouns/i.test(l))).toBe(true);
  });
  it("preferred name does not steal the first-name field", async () => {
    document.body.innerHTML = `<label for="p">Preferred First Name</label><input id="p"><label for="f">First Name*</label><input id="f">`;
    await fillForm(document, { ...values, preferredName: "May" }, { ats: "generic" });
    expect((document.getElementById("f") as HTMLInputElement).value).toBe("Maya");
    expect((document.getElementById("p") as HTMLInputElement).value).toBe("May");
  });
  it("yes/no radios and native selects", async () => {
    document.body.innerHTML = `<fieldset><legend>Are you legally authorized to work in the United States?</legend><label><input type="radio" name="q1" value="Yes">Yes</label><label><input type="radio" name="q1" value="No">No</label></fieldset>
      <div><label for="s">Will you now or in the future require sponsorship for a visa?</label><select id="s"><option value="">Select</option><option value="1">Yes</option><option value="0">No</option></select></div>`;
    await fillForm(document, values, { ats: "generic" });
    expect((document.querySelector('input[name="q1"][value="Yes"]') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById("s") as HTMLSelectElement).value).toBe("0");
  });
  it("checkbox groups and number inputs: disciplines as checkboxes, start/end year as inputs, expected graduation date", async () => {
    document.body.innerHTML = `<label for="sy">Start date year*</label><input type="number" id="sy"><label for="ey">End date year*</label><input type="number" id="ey">
      <div><label><input type="checkbox" id="c1">Computer Science</label><label><input type="checkbox" id="c2">Information Technology</label><label><input type="checkbox" id="c3">Information Systems</label></div>`;
    const gd = reactSelect("q_gd", "Please re-confirm your expected graduation date*", ["December 2026", "May 2027", "December 2027"]);
    await fillForm(document, { ...values, gradDate: "May 2027" }, { ats: "greenhouse" });
    expect((document.getElementById("sy") as HTMLInputElement).value).toBe("2025"); expect((document.getElementById("ey") as HTMLInputElement).value).toBe("2027");
    expect((document.getElementById("c1") as HTMLInputElement).checked).toBe(false); expect((document.getElementById("c2") as HTMLInputElement).checked).toBe(true); expect((document.getElementById("c3") as HTMLInputElement).checked).toBe(true);
    expect(gd.value.textContent).toBe("May 2027");
  });
  it("react-select comboboxes: country, residence, work auth, sponsorship, years, disciplines (multi)", async () => {
    document.body.innerHTML = "";
    const country = reactSelect("q_country", "Country*", ["Canada", "United Kingdom", "United States"]);
    const reside = reactSelect("q_reside", "What country do you currently reside in?*", ["Canada", "United States"]);
    const state = reactSelect("q_state", "If applicable, which US state do you reside in?", ["Vermont", "Virginia", "Washington"]);
    const auth = reactSelect("q_auth", "Are you legally authorized to work in the country where this role is based?*", ["Yes", "No"]);
    const spons = reactSelect("q_spons", "Will you now or in the future require employer sponsorship for work authorization in this country?*", ["Yes", "No"]);
    const sy = reactSelect("q_sy", "Start date year*", ["2024", "2025", "2026"]);
    const ey = reactSelect("q_ey", "End date year*", ["2026", "2027", "2028"]);
    const school = reactSelect("q_school", "School*", ["Northern Virginia Community College", "North Carolina State University", "NOVA Southeastern"]);
    const disc = reactSelect("q_disc", "Undergrad Discipline(s)*", ["Computer Science", "Information Technology", "Information Systems", "Mathematics"], true);
    const { results } = await fillForm(document, values, { ats: "greenhouse" });
    expect(country.value.textContent).toBe("United States");
    expect(reside.value.textContent).toBe("United States");
    expect(state.value.textContent).toBe("Virginia");
    expect(auth.value.textContent).toBe("Yes");
    expect(spons.value.textContent).toBe("No");
    expect(sy.value.textContent).toBe("2025"); expect(ey.value.textContent).toBe("2027");
    expect(school.value.textContent).toBe("Northern Virginia Community College");
    expect(disc.value.textContent).toContain("Information Technology"); expect(disc.value.textContent).toContain("Information Systems");
    // long-sentence yes/no answers, like Greenhouse renders them
    document.body.innerHTML = "";
    const auth2 = reactSelect("q_auth2", "Are you legally authorized to work in the country where this role is based?*", ["Yes, I am authorized to work in this country", "No, I am not authorized"]);
    await fillForm(document, values, { ats: "greenhouse" });
    expect(auth2.value.textContent).toMatch(/^Yes/);
    expect(results.filter((r) => !r.success)).toEqual([]);
  }, 30000);
  it("atsOf", () => { expect(atsOf("job-boards.greenhouse.io")).toBe("greenhouse"); expect(atsOf("careers.acme.com")).toBe("generic"); });
});

import { attachFile } from "./fill";
describe("attachFile", () => {
  it("puts the resume in the resume input and the letter in the letter input, never crosswise", () => {
    document.body.innerHTML = `<label for="r">Resume/CV*</label><input type="file" id="r"><label for="c">Cover Letter</label><input type="file" id="c">`;
    const pdf = new File([new Uint8Array([37, 80, 68, 70])], "Maya_Resume.pdf", { type: "application/pdf" });
    const a = attachFile(document, "resume", pdf);
    expect(a.success).toBe(true); expect(a.selector).toBe("#r");
    expect((document.getElementById("r") as HTMLInputElement).files?.[0]?.name).toBe("Maya_Resume.pdf");
    expect((document.getElementById("c") as HTMLInputElement).files?.length ?? 0).toBe(0);
    const b = attachFile(document, "letter", new File(["x"], "letter.pdf", { type: "application/pdf" }));
    expect(b.selector).toBe("#c");
  });
  it("does nothing when there is no matching input", () => {
    document.body.innerHTML = `<label for="p">Photo</label><input type="file" id="p"><input type="file" id="q">`;
    expect(attachFile(document, "letter", new File(["x"], "l.pdf")).success).toBe(false);
  });
});
