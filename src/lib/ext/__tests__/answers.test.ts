import { describe, expect, it } from "vitest";
import { answerQuestions, NEVER } from "../answers";
import type { CanonicalProfile } from "../../schemas/profile";

const profile: CanonicalProfile = {
  version: 1, name: "Maya Patel", email: "m@x.edu", phone: null, preferredName: null, address: { street: null, city: "McLean", state: "VA", zip: null }, links: { linkedin: null, github: null, portfolio: null }, headline: "IT student", targetRoles: [],
  skills: [{ name: "Python", key: "python", level: "strong", source: "resume" }],
  experience: [{ id: "e1", title: "Help Desk", org: "NOVA", kind: "job", start: "2025-08", end: null, bullets: ["Resolved 300 tickets"], skills: [], source: "resume" }],
  education: [{ school: "NOVA", degree: "AAS", field: "IST", startYear: 2025, gradYear: 2027, gpa: null, source: "resume" } as CanonicalProfile["education"][number]], certifications: [],
  constraints: { workAuthorization: "us_citizen", clearance: "none", locations: ["McLean, VA"], workCountries: [], maxCommuteMiles: null, remoteOk: true, employmentTypes: ["internship"], earliestStart: null, minPayHourly: null },
};

const fake = (json: unknown) => ({ messages: { create: async () => ({ content: [{ type: "text", text: JSON.stringify(json) }] }) } }) as unknown as Parameters<typeof answerQuestions>[3];

describe("answerQuestions", () => {
  it("keeps option answers verbatim, drops made-up options, never sends EEO or referral questions to the model", async () => {
    const qs = [
      { id: "1", label: "Do you have relevant internship experience at a proprietary trading firm?", kind: "radio", options: ["Yes", "No"] },
      { id: "2", label: "What country do you currently reside in?", kind: "combobox", options: ["Canada", "United States"] },
      { id: "3", label: "Gender", kind: "select", options: ["Male", "Female"] },
      { id: "4", label: "How did you hear about DV Trading?", kind: "select", options: ["LinkedIn", "Other"] },
      { id: "5", label: "Years of Python experience", kind: "text" },
    ];
    let seen = "";
    const client = { messages: { create: async (req: { messages: { content: string }[] }) => { seen = req.messages[0]!.content; return { content: [{ type: "text", text: JSON.stringify({ answers: [
      { id: "1", value: "No", why: "no trading-firm job listed" }, { id: "2", value: "USA", why: "address" }, { id: "5", value: "2", why: "python strong" },
    ] }) }] }; } } } as unknown as Parameters<typeof answerQuestions>[3];
    const out = await answerQuestions(profile, qs, { title: "SWE", company: "DV" }, client);
    expect(seen).not.toMatch(/Gender|hear about/);
    const by = (id: string) => out.find((a) => a.id === id)!;
    expect(by("1").value).toBe("No");
    expect(by("2").value).toBeNull(); // "USA" is not a listed option: enforced, not guessed
    expect(by("3").value).toBeNull(); expect(by("4").value).toBeNull();
    expect(by("5").value).toBe("2");
  });
  it("returns nulls when the model output is unusable", async () => {
    const out = await answerQuestions(profile, [{ id: "1", label: "Why us?", kind: "textarea" }], {}, fake({ nope: true }));
    expect(out).toEqual([]);
  });
  it("NEVER covers demographics, referral, pay and identifiers", () => {
    for (const l of ["Gender", "Are you Hispanic/Latino?", "Veteran Status", "Disability Status", "What are your preferred pronouns?", "How did you hear about us?", "Desired salary", "Date of birth"]) expect(NEVER.test(l)).toBe(true);
    expect(NEVER.test("What country do you currently reside in?")).toBe(false);
  });
});
