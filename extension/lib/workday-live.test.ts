// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { wdStep, wdListbox, wdSearch, wdDate, wdText, wdEnsureRows, wdFillExperience, wdNextButton } from "./workday";
import { scanFields, applyAnswer } from "./scan";
import { labelTextFor } from "./fill";
import { wdDropdown, wdPrompt, wdDateField, wdPage, wdSection, formField } from "./workday-fixture";
import type { Me } from "./api";

const me: Me = { name: "Maya Patel", email: "m@x.edu", plan: "free", credits: 3, skills: ["Python", "AWS"],
  fields: { firstName: "Maya", lastName: "Patel", city: "McLean", linkedin: "linkedin.com/in/maya" },
  experience: [{ title: "Help Desk", org: "NOVA", kind: "job", start: "2025-08", end: null, current: true, bullets: ["Resolved 300 tickets."] }],
  education: [{ school: "Northern Virginia Community College", degree: "AAS", degreeName: "Associate's Degree", field: "Information Systems", startYear: 2025, gradYear: 2027, gpa: 3.6 }] };

beforeEach(() => { document.body.innerHTML = ""; });

describe("workday, against a page shaped like the real thing", () => {
  it("knows the step from the page marker, not the progress bar", () => {
    wdPage("contactInformationPage", "My Information");
    expect(wdStep().key).toBe("info");
    document.body.innerHTML = ""; wdPage("myExperiencePage", "Application");
    expect(wdStep().key).toBe("experience");
  });

  it("reads a label that sits two levels above the control", () => {
    const w = formField("q1", "Are you legally authorized to work in the United States?", `<input data-automation-id="q1">`);
    const input = w.querySelector("input")!;
    expect(labelTextFor(input, document)).toMatch(/legally authorized/);
  });

  it("picks from a dropdown whose options are in a fixed portal", async () => {
    const btn = wdDropdown("addressSection_countryRegion", "State", ["Vermont", "Virginia", "Washington"]);
    expect(await wdListbox("addressSection_countryRegion", "Virginia")).toBe(true);
    expect(btn.textContent).toBe("Virginia");
  });

  it("falls back to type-ahead + Enter when the option is not rendered (virtualized list)", async () => {
    // a list that renders no options until typed into, the way long Workday lists behave
    const w = formField("countryDropdown", "Country", `<button data-automation-id="countryDropdown" aria-haspopup="listbox">Select One</button>`);
    const btn = w.querySelector("button")!;
    let typed = "";
    btn.addEventListener("keydown", (e) => { const k = (e as KeyboardEvent).key; if (k === "Enter") { if (typed.toLowerCase().startsWith("united")) btn.textContent = "United States of America"; } else if (k.length === 1) typed += k; });
    expect(await wdListbox("countryDropdown", "United States of America")).toBe(true);
    expect(btn.textContent).toBe("United States of America");
  });

  it("a search prompt needs two Enters and reports the chip, not the empty box", async () => {
    wdPrompt("schoolItem", "School or University", ["Northern Virginia Community College", "North Carolina State University"]);
    expect(await wdSearch("schoolItem", "Northern Virginia Community College")).toBe(true);
    expect(document.querySelector('[data-automation-id="selectedItem"]')!.textContent).toBe("Northern Virginia Community College");
    const f = scanFields(document).find((x) => /School/.test(x.label))!;
    expect(f.filled).toBe(true);
    expect(f.value).toMatch(/Northern Virginia/);
  });

  it("dates go into the section spinbuttons inside the wrapper", () => {
    wdDateField("startDate", "From");
    expect(wdDate("startDate", "2025-08")).toBe(true);
    expect((document.querySelector('[data-automation-id="dateSectionMonth-input"]') as HTMLInputElement).value).toBe("8");
    expect((document.querySelector('[data-automation-id="dateSectionYear-input"]') as HTMLInputElement).value).toBe("2025");
  });

  it("education uses the formField ids Workday actually ships", async () => {
    wdSection("educationSection", "education", () => `
      <div data-automation-id="formField-schoolItem"><div><label>School or University*</label></div><div><input data-automation-id="searchBox"><div class="chips"></div></div></div>
      <div data-automation-id="formField-gradeAverage"><div><label>Overall Result (GPA)</label></div><div><input></div></div>
      <div data-automation-id="formField-firstYearAttended"><div><label>From</label></div><div><input></div></div>
      <div data-automation-id="formField-lastYearAttended"><div><label>To</label></div><div><input></div></div>`);
    const rows = await wdEnsureRows("educationSection", "education", 1);
    expect(rows.length).toBe(1);
    const row = rows[0]!;
    expect(wdText("gradeAverage", "3.6", row)).toBe(true);
    expect((row.querySelector('[data-automation-id="formField-gradeAverage"] input') as HTMLInputElement).value).toBe("3.6");
    expect(wdDate("lastYearAttended", "2027", row)).toBe(true);
    expect((row.querySelector('[data-automation-id="formField-lastYearAttended"] input') as HTMLInputElement).value).toBe("2027");
  });

  it("work rows fill and the add button renames itself to Add Another", async () => {
    wdSection("workExperienceSection", "workExperience", () => `
      <input data-automation-id="jobTitle"><input data-automation-id="company">
      <input type="checkbox" data-automation-id="currentlyWorkHere">
      <div data-automation-id="formField-startDate"><div><input data-automation-id="dateSectionMonth-input"><input data-automation-id="dateSectionYear-input"></div></div>
      <textarea data-automation-id="description"></textarea>`);
    await wdFillExperience(me, []);
    const r = document.querySelector('[data-automation-id="workExperience-1"]')!;
    expect((r.querySelector('[data-automation-id="jobTitle"]') as HTMLInputElement).value).toBe("Help Desk");
    expect((r.querySelector('[data-automation-id="currentlyWorkHere"]') as HTMLInputElement).checked).toBe(true);
    expect((r.querySelector('[data-automation-id="dateSectionYear-input"]') as HTMLInputElement).value).toBe("2025");
  });

  it("the questions page: every dropdown is seen with its label and answered", async () => {
    wdPage("applicationQuestionsPage", "Application Questions");
    const qs = [
      ["q1", "Are you a U.S. citizen, lawful permanent resident, refugee, or person granted asylum?"],
      ["q2", "Will you now or in the future require sponsorship for employment visa status?"],
      ["q3", "Have you ever interviewed for a position at Vanguard or any of its subsidiaries?"],
    ] as const;
    for (const [n, l] of qs) wdDropdown(n, l, ["Yes", "No"]);
    const fields = scanFields(document).filter((f) => f.kind === "listbox");
    expect(fields.length).toBe(3);
    expect(fields.map((f) => f.label)).toEqual(qs.map(([, l]) => l));
    for (const f of fields) expect(await applyAnswer(document, f, "No")).toBe(true);
    expect(scanFields(document).filter((f) => f.kind === "listbox" && f.filled).length).toBe(3);
  });

  it("finds the forward button by id and by its words", () => {
    wdPage("contactInformationPage", "My Information");
    expect(wdNextButton()?.textContent).toBe("Save and Continue");
    document.body.innerHTML = `<button>Continue</button>`;
    expect(wdNextButton()?.textContent).toBe("Continue");
  });
});

/** Regressions caught by the real-browser suite (extension/e2e) and pinned here for fast feedback. */
describe("labels on grouped and long questions", () => {
  it("a radio group is labelled with its question, not its first option", () => {
    document.body.innerHTML = `<div data-automation-id="formField-previousWorker"><div><label>Do you currently work, or have you ever worked for or with Vanguard?*</label></div>
      <div><div data-automation-id="previousWorker" role="radiogroup"><label><input type="radio" name="pw" value="Yes">Yes</label><label><input type="radio" name="pw" value="No">No</label></div></div></div>`;
    const f = scanFields(document)[0]!;
    expect(f.kind).toBe("radio");
    expect(f.label).toMatch(/worked for or with Vanguard/);
  });

  it("a checkbox group is labelled with its question, not its first option", () => {
    document.body.innerHTML = `<div data-automation-id="formField-exams"><div><label>Have you ever taken a FINRA licensing exam? (Select all that apply)*</label></div>
      <div><div data-automation-id="exams">${["SIE", "S7", "No"].map((o) => `<label><input type="checkbox" name="exams[]" value="${o}">${o}</label>`).join("")}</div></div></div>`;
    const f = scanFields(document)[0]!;
    expect(f.kind).toBe("checkboxes");
    expect(f.label).toMatch(/FINRA/);
    expect(f.options).toEqual(["SIE", "S7", "No"]);
  });

  it("a question longer than 220 characters is still scanned (Workday's compliance questions run long)", () => {
    const long = "Securities industry regulations require investment advisory firms to collect data on political contributions made within the last 2 years. This information is used to ensure we are following regulatory requirements. Have you made a political contribution to any political official, candidate, party, or organization within the last 2 years?";
    expect(long.length).toBeGreaterThan(220);
    wdDropdown("q12", long, ["Yes", "No"]);
    const f = scanFields(document).find((x) => x.kind === "listbox");
    expect(f).toBeDefined();
    expect(f!.label).toBe(long);
  });
});
