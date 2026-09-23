import { describe, it, expect } from "vitest";
import { applyPrefs, isEssay, readPrefs } from "../prefs";
import type { FillFields } from "../fields";

describe("autofill prefs", () => {
  it("defaults and tolerates junk", () => {
    expect(readPrefs(null)).toMatchObject({ essays: "draft", coverLetter: "when_asked", resume: "tailored", relocate: "auto", payText: null });
    expect(readPrefs({ essays: "nope", resume: "base" })).toMatchObject({ essays: "draft", resume: "base" });
  });
  it("user answers override inferred ones", () => {
    const f = { desiredPay: "$20/hour", willRelocate: true } as FillFields;
    expect(applyPrefs(f, readPrefs({ payText: "Negotiable", relocate: "no" }))).toMatchObject({ desiredPay: "Negotiable", willRelocate: false });
    expect(applyPrefs(f, readPrefs({}))).toMatchObject({ desiredPay: "$20/hour", willRelocate: true });
  });
  it("spots essay questions", () => {
    expect(isEssay({ label: "Why do you want to work at Leidos?", kind: "textarea" })).toBe(true);
    expect(isEssay({ label: "Describe a time you had to learn a new tool quickly for a project.", kind: "text" })).toBe(true);
    expect(isEssay({ label: "LinkedIn profile", kind: "text" })).toBe(false);
  });
});
