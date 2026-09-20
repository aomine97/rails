// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fillForm, atsOf } from "./fill";

const values = { firstName: "Maya", lastName: "Patel", fullName: "Maya Patel", email: "maya@example.edu", phone: "5715551212", linkedin: "linkedin.com/in/maya", github: "github.com/maya", city: "McLean", state: "VA", school: "NOVA", needsSponsorship: false, workAuthorized: true } as const;

describe("fillForm", () => {
  it("greenhouse: ATS selectors first", () => {
    document.body.innerHTML = `<form><input id="first_name"><input id="last_name"><input id="email" type="email"><input id="phone"><input name="job_application[answers_attributes][0][text_value]" aria-label="LinkedIn Profile"><button type="submit">Submit</button></form>`;
    const r = fillForm(document, values, { ats: "greenhouse" });
    expect((document.getElementById("first_name") as HTMLInputElement).value).toBe("Maya");
    expect((document.getElementById("email") as HTMLInputElement).value).toBe("maya@example.edu");
    expect(r.find((x) => x.key === "linkedin")?.strategy).toBe("label");
    expect(r.every((x) => x.success)).toBe(true);
  });
  it("lever: full name, urls, org", () => {
    document.body.innerHTML = `<input name="name"><input name="email"><input name="phone"><input name="urls[LinkedIn]"><input name="urls[GitHub]"><input name="org">`;
    fillForm(document, values, { ats: "lever" });
    expect((document.querySelector('input[name="name"]') as HTMLInputElement).value).toBe("Maya Patel");
    expect((document.querySelector('input[name="urls[GitHub]"]') as HTMLInputElement).value).toBe("github.com/maya");
    expect((document.querySelector('input[name="org"]') as HTMLInputElement).value).toBe("NOVA");
  });
  it("generic: autocomplete, labels, placeholders; never overwrites typed text; never touches file/submit", () => {
    document.body.innerHTML = `<label for="a">First Name</label><input id="a"><label>Last Name <input id="b"></label><input autocomplete="email" id="c"><input placeholder="(555) 555-5555" id="d"><input id="e" value="already typed" name="linkedin"><input type="file" name="resume"><input type="submit" value="Apply">`;
    const r = fillForm(document, values, { ats: "generic" });
    expect((document.getElementById("a") as HTMLInputElement).value).toBe("Maya");
    expect((document.getElementById("b") as HTMLInputElement).value).toBe("Patel");
    expect((document.getElementById("c") as HTMLInputElement).value).toBe("maya@example.edu");
    expect((document.getElementById("d") as HTMLInputElement).value).toBe("5715551212");
    expect((document.getElementById("e") as HTMLInputElement).value).toBe("already typed");
    expect(r.find((x) => x.key === "linkedin")?.strategy).toBe("name:kept");
    expect(r.some((x) => x.key === "firstName" && x.strategy === "label")).toBe(true);
  });
  it("yes/no questions: radios and selects", () => {
    document.body.innerHTML = `<fieldset><legend>Are you legally authorized to work in the United States?</legend><label><input type="radio" name="q1" value="Yes">Yes</label><label><input type="radio" name="q1" value="No">No</label></fieldset>
      <div><label for="s">Will you now or in the future require sponsorship for a visa?</label><select id="s"><option value="">Select</option><option value="1">Yes</option><option value="0">No</option></select></div>`;
    const r = fillForm(document, values, { ats: "generic" });
    expect((document.querySelector('input[name="q1"][value="Yes"]') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById("s") as HTMLSelectElement).value).toBe("0");
    expect(r.filter((x) => x.key === "workAuthorized" || x.key === "needsSponsorship").every((x) => x.success)).toBe(true);
  });
  it("learned selectors win", () => {
    document.body.innerHTML = `<input id="weird_fn_field"><input id="first_name">`;
    const r = fillForm(document, values, { ats: "generic", learned: { firstName: ["#weird_fn_field"] } });
    expect((document.getElementById("weird_fn_field") as HTMLInputElement).value).toBe("Maya");
    expect(r.find((x) => x.key === "firstName")?.strategy).toBe("learned");
  });
  it("atsOf", () => {
    expect(atsOf("job-boards.greenhouse.io")).toBe("greenhouse"); expect(atsOf("acme.wd5.myworkdayjobs.com")).toBe("workday"); expect(atsOf("careers.acme.com")).toBe("generic");
  });
});
