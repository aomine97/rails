// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { scanFields, applyAnswer, bestOptionText } from "./scan";

const FORM = `<form>
  <label for="fn">First Name*</label><input id="fn" required>
  <label for="ln">Last Name*</label><input id="ln" value="Patel">
  <label for="why">Why DV Trading?</label><textarea id="why"></textarea>
  <label for="st">If applicable, which US state do you reside in?</label><select id="st"><option value="">Select...</option><option>Vermont</option><option>Virginia</option></select>
  <fieldset><legend>Do you have relevant internship experience at a proprietary trading firm?*</legend><label><input type="radio" name="q1" value="0">Yes</label><label><input type="radio" name="q1" value="1">No</label></fieldset>
  <fieldset><legend>Undergrad Discipline(s)*</legend><label><input type="checkbox" name="q2[]" value="a">Computer Science</label><label><input type="checkbox" name="q2[]" value="b">Information Technology</label><label><input type="checkbox" name="q2[]" value="c">Mathematics</label></fieldset>
  <label><input type="checkbox" id="tc"> I agree to the Terms & Conditions*</label>
  <label for="g">Gender</label><select id="g"><option value="">Select...</option><option>Male</option><option>Female</option><option>Decline to self-identify</option></select>
  <label for="vt">If yes, please provide your visa type and expiration date.</label><input id="vt">
  <label for="r">Resume/CV*</label><input type="file" id="r">
  <input type="hidden" name="token"><button type="submit">Submit</button>
</form>`;

describe("scanFields", () => {
  it("lists every question with kind, options, required, filled, sensitive, conditional", () => {
    document.body.innerHTML = FORM;
    const f = scanFields(document);
    const by = (l: RegExp) => f.find((x) => l.test(x.label))!;
    expect(f.map((x) => x.kind)).toEqual(["text", "text", "textarea", "select", "radio", "checkboxes", "checkbox", "select", "text", "file"]);
    expect(by(/First Name/).required).toBe(true); expect(by(/First Name/).filled).toBe(false);
    expect(by(/Last Name/).filled).toBe(true); expect(by(/Last Name/).value).toBe("Patel");
    expect(by(/US state/).options).toEqual(["Vermont", "Virginia"]); expect(by(/US state/).conditional).toBe(true); expect(by(/US state/).filled).toBe(false);
    expect(by(/proprietary trading/).options).toEqual(["Yes", "No"]); expect(by(/proprietary trading/).required).toBe(true);
    expect(by(/Discipline/).options).toEqual(["Computer Science", "Information Technology", "Mathematics"]);
    expect(by(/Terms/).legal).toBe(true); expect(by(/Terms/).kind).toBe("checkbox");
    expect(by(/Gender/).sensitive).toBe(true);
    expect(by(/visa type/).conditional).toBe(true);
    expect(by(/Resume/).kind).toBe("file"); expect(by(/Resume/).required).toBe(true);
    expect(f.some((x) => /token/.test(x.label))).toBe(false);
  });
  it("ids are stable across scans", () => {
    document.body.innerHTML = FORM;
    const a = scanFields(document); const b = scanFields(document);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  });
});

describe("applyAnswer", () => {
  it("radio, select, checkbox group, single checkbox, text, textarea", async () => {
    document.body.innerHTML = FORM;
    const f = scanFields(document); const by = (l: RegExp) => f.find((x) => l.test(x.label))!;
    expect(await applyAnswer(document, by(/proprietary trading/), "No")).toBe(true);
    expect((document.querySelector('input[name="q1"][value="1"]') as HTMLInputElement).checked).toBe(true);
    expect(await applyAnswer(document, by(/US state/), "Virginia")).toBe(true);
    expect((document.getElementById("st") as HTMLSelectElement).value).toBe("Virginia");
    expect(await applyAnswer(document, by(/Discipline/), ["Information Technology", "Mathematics"])).toBe(true);
    expect([...document.querySelectorAll<HTMLInputElement>('input[name="q2[]"]')].map((c) => c.checked)).toEqual([false, true, true]);
    expect(await applyAnswer(document, by(/Terms/), true)).toBe(true);
    expect((document.getElementById("tc") as HTMLInputElement).checked).toBe(true);
    expect(await applyAnswer(document, by(/First Name/), "Maya")).toBe(true);
    expect(await applyAnswer(document, by(/Why DV/), "Because of the market-making work.")).toBe(true);
    expect((document.getElementById("why") as HTMLTextAreaElement).value).toMatch(/market-making/);
    // a rescan now sees them filled
    const again = scanFields(document); const by2 = (l: RegExp) => again.find((x) => l.test(x.label))!;
    expect(by2(/proprietary trading/).filled).toBe(true); expect(by2(/proprietary trading/).value).toBe("No");
    expect(by2(/Discipline/).value).toBe("Information Technology, Mathematics");
    expect(by2(/US state/).filled).toBe(true);
  });
  it("never touches file inputs; rejects answers that match no option", async () => {
    document.body.innerHTML = FORM;
    const f = scanFields(document); const by = (l: RegExp) => f.find((x) => l.test(x.label))!;
    expect(await applyAnswer(document, by(/Resume/), "x.pdf")).toBe(false);
    expect(await applyAnswer(document, by(/US state/), "Ontario")).toBe(false);
  });
  it("bestOptionText matches long yes/no sentences", () => {
    expect(bestOptionText(["Yes, I am authorized to work in this country", "No, I am not"], "Yes")).toMatch(/^Yes/);
    expect(bestOptionText(["Canada", "United Kingdom", "United States"], "United States")).toBe("United States");
  });
});
