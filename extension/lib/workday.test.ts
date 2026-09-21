// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { wdStep, wdListbox, wdDate, wdEnsureRows, wdFillInfo, wdFillExperience, wdErrors } from "./workday";
import { scanFields, applyAnswer } from "./scan";
import type { Me } from "./api";

/** A Workday-shaped page: progress bar, listbox buttons that open a portal listbox, split date inputs, an Add Another section. */
function listboxButton(id: string, options: string[], label = "") {
  const wrap = document.createElement("div"); wrap.setAttribute("data-automation-id", `formField-${id}`);
  wrap.innerHTML = `<label>${label}</label><button data-automation-id="${id}" aria-haspopup="listbox">Select One</button>`;
  const btn = wrap.querySelector("button")!;
  btn.addEventListener("click", () => {
    document.querySelector("#portal")?.remove();
    const p = document.createElement("div"); p.id = "portal"; p.innerHTML = `<ul role="listbox">${options.map((o) => `<li role="option">${o}</li>`).join("")}</ul>`;
    for (const li of p.querySelectorAll("li")) li.addEventListener("click", () => { btn.textContent = li.textContent; p.remove(); });
    document.body.appendChild(p);
  });
  document.body.appendChild(wrap); return btn;
}
function setupInfo() {
  document.body.innerHTML = `<div data-automation-id="progressBar"><li data-automation-id="progressBarActiveStep">My Information</li><li data-automation-id="progressBarInactiveStep">My Experience</li><li data-automation-id="progressBarInactiveStep">Application Questions</li></div>
    <input data-automation-id="legalNameSection_firstName"><input data-automation-id="legalNameSection_lastName">
    <input data-automation-id="addressSection_addressLine1"><input data-automation-id="addressSection_city"><input data-automation-id="addressSection_postalCode">
    <input data-automation-id="email" value="already@typed.com"><input data-automation-id="phone-number">
    <div data-automation-id="previousWorker"><label><input type="radio" name="pw" value="1">Yes</label><label><input type="radio" name="pw" value="0">No</label></div>`;
  listboxButton("countryDropdown", ["Canada", "United States of America"]);
  listboxButton("addressSection_countryRegion", ["Vermont", "Virginia", "Washington"]);
  listboxButton("phone-device-type", ["Home", "Mobile", "Work"]);
  listboxButton("sourceSection", ["LinkedIn", "Indeed", "Other"], "How Did You Hear About Us?");
}
const me: Me = { name: "Maya Patel", email: "maya@example.edu", plan: "free", credits: 3, skills: ["Python", "AWS"],
  fields: { firstName: "Maya", lastName: "Patel", email: "maya@example.edu", phone: "(571) 555-1212", street: "1 Main St", city: "McLean", state: "VA", stateName: "Virginia", zip: "22101", preferredName: null, linkedin: "linkedin.com/in/maya", github: null, portfolio: null },
  experience: [{ title: "Help Desk", org: "NOVA", kind: "job", start: "2025-08", end: null, current: true, bullets: ["Resolved 300 tickets."] }, { title: "ML Intern", org: "Stealth", kind: "internship", start: "2026-06", end: "2026-08", current: false, bullets: ["Built pipelines."] }],
  education: [{ school: "Northern Virginia Community College", degree: "AAS", degreeName: "Associate's Degree", field: "Information Systems", startYear: 2025, gradYear: 2027, gpa: 3.6 }] };

describe("workday", () => {
  it("reads the step from the progress bar", () => { setupInfo(); const s = wdStep(); expect(s.key).toBe("info"); expect(s.index).toBe(1); expect(s.total).toBe(3); });
  it("listbox buttons open a portal list and take the pick", async () => {
    setupInfo();
    expect(await wdListbox("addressSection_countryRegion", "Virginia")).toBe(true);
    expect(document.querySelector('[data-automation-id="addressSection_countryRegion"]')!.textContent).toBe("Virginia");
    expect(await wdListbox("addressSection_countryRegion", "Ontario")).toBe(false);
  });
  it("split dates take month and year", () => {
    document.body.innerHTML = `<div data-automation-id="workExperience-1"><input data-automation-id="startDate-dateSectionMonth-input"><input data-automation-id="startDate-dateSectionYear-input"></div>`;
    const row = document.querySelector<HTMLElement>('[data-automation-id="workExperience-1"]')!;
    expect(wdDate("startDate", "2025-08", row)).toBe(true);
    expect((row.querySelector('[data-automation-id="startDate-dateSectionMonth-input"]') as HTMLInputElement).value).toBe("8");
    expect((row.querySelector('[data-automation-id="startDate-dateSectionYear-input"]') as HTMLInputElement).value).toBe("2025");
  });
  it("Add Another creates the rows it needs, then each row is filled from the profile", async () => {
    document.body.innerHTML = `<div data-automation-id="progressBar"><li data-automation-id="progressBarActiveStep">My Experience</li></div><div data-automation-id="workExperienceSection"><button data-automation-id="Add">Add</button></div><div data-automation-id="educationSection"><button data-automation-id="Add">Add</button></div>`;
    let n = 0;
    for (const sec of ["workExperienceSection", "educationSection"]) {
      const section = document.querySelector(`[data-automation-id="${sec}"]`)!; const prefix = sec === "workExperienceSection" ? "workExperience" : "education";
      section.querySelector("button")!.addEventListener("click", () => { n++; const row = document.createElement("div"); row.setAttribute("data-automation-id", `${prefix}-${section.querySelectorAll(`[data-automation-id^="${prefix}-"]`).length + 1}`);
        row.innerHTML = prefix === "workExperience" ? `<input data-automation-id="jobTitle"><input data-automation-id="company"><input data-automation-id="location"><input type="checkbox" data-automation-id="currentlyWorkHere"><input data-automation-id="startDate-dateSectionMonth-input"><input data-automation-id="startDate-dateSectionYear-input"><input data-automation-id="endDate-dateSectionMonth-input"><input data-automation-id="endDate-dateSectionYear-input"><textarea data-automation-id="description"></textarea>` : `<input data-automation-id="schoolName"><input data-automation-id="gpa"><input data-automation-id="firstYearAttended-dateSectionYear-input"><input data-automation-id="lastYearAttended-dateSectionYear-input">`;
        section.insertBefore(row, section.querySelector("button")); });
    }
    const rows = await wdEnsureRows("workExperienceSection", "workExperience", 2); expect(rows.length).toBe(2);
    const rep = await wdFillExperience(me, []);
    const r1 = document.querySelector('[data-automation-id="workExperience-1"]')!; const r2 = document.querySelector('[data-automation-id="workExperience-2"]')!;
    expect((r1.querySelector('[data-automation-id="jobTitle"]') as HTMLInputElement).value).toBe("Help Desk");
    expect((r1.querySelector('[data-automation-id="currentlyWorkHere"]') as HTMLInputElement).checked).toBe(true);
    expect((r2.querySelector('[data-automation-id="company"]') as HTMLInputElement).value).toBe("Stealth");
    expect((r2.querySelector('[data-automation-id="endDate-dateSectionYear-input"]') as HTMLInputElement).value).toBe("2026");
    expect((document.querySelector('[data-automation-id="education-1"] [data-automation-id="schoolName"]') as HTMLInputElement).value).toBe("Northern Virginia Community College");
    expect((document.querySelector('[data-automation-id="education-1"] [data-automation-id="gpa"]') as HTMLInputElement).value).toBe("3.6");
    expect(rep.filter((r) => r.success).map((r) => r.key)).toEqual(["work-1", "work-2", "edu-1"]);
    expect(n).toBe(3);
  });
  it("My Information: text, listboxes, phone type, radio; never overwrites a typed email", async () => {
    setupInfo();
    const rep = await wdFillInfo(me, { "how did you hear about us": "LinkedIn" });
    const v = (id: string) => (document.querySelector(`[data-automation-id="${id}"]`) as HTMLInputElement).value;
    expect(v("legalNameSection_firstName")).toBe("Maya"); expect(v("addressSection_postalCode")).toBe("22101"); expect(v("phone-number")).toBe("5715551212");
    expect(v("email")).toBe("already@typed.com");
    expect(document.querySelector('[data-automation-id="addressSection_countryRegion"]')!.textContent).toBe("Virginia");
    expect(document.querySelector('[data-automation-id="phone-device-type"]')!.textContent).toBe("Mobile");
    expect(document.querySelector('[data-automation-id="sourceSection"]')!.textContent).toBe("LinkedIn");
    expect((document.querySelector('input[name="pw"][value="0"]') as HTMLInputElement).checked).toBe(true);
    expect(rep.find((r) => r.key === "state")?.success).toBe(true);
  });
  it("generic scanner sees listbox buttons as questions and applyAnswer picks from them", async () => {
    document.body.innerHTML = ""; listboxButton("q1", ["Yes", "No"], "Are you at least 18 years of age?");
    const f = scanFields(document); expect(f[0]!.kind).toBe("listbox"); expect(f[0]!.label).toMatch(/18 years/); expect(f[0]!.filled).toBe(false);
    expect(await applyAnswer(document, f[0]!, "Yes")).toBe(true);
    expect(scanFields(document)[0]!.value).toBe("Yes");
  });
  it("reads Workday validation errors", () => { document.body.innerHTML = `<div data-automation-id="errorMessage">Phone Number is required.</div>`; expect(wdErrors()).toEqual(["Phone Number is required."]); });
});
