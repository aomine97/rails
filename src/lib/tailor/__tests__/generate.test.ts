import { describe, expect, it } from "vitest";
import { validateTailored } from "../generate";
import type { CanonicalProfile } from "../../schemas/profile";
import type { JobTags } from "../../jobs/tags";

const profile: CanonicalProfile = {
  version: 1, name: "Maya", email: "m@x.edu", phone: null, preferredName: null, address: { street: null, city: null, state: null, zip: null }, links: { linkedin: null, github: null, portfolio: null }, headline: "IT student", targetRoles: [],
  skills: [{ name: "Python", key: "python", level: "strong", source: "resume" }, { name: "AWS", key: "aws", level: "working", source: "user" }],
  experience: [{ id: "e1", title: "Help Desk", org: "NOVA", kind: "job", start: "2025-08", end: null, bullets: ["Resolved 300 tickets in ServiceNow", "Imaged lab machines"], skills: [], source: "resume" }],
  education: [], certifications: [],
  constraints: { workAuthorization: "unknown", clearance: "none", locations: [], workCountries: [], maxCommuteMiles: null, remoteOk: true, employmentTypes: ["internship"], earliestStart: null, minPayHourly: null },
};
const tags = { requiredSkills: ["python", "aws"], preferredSkills: ["servicenow"] } as unknown as JobTags;

describe("validateTailored", () => {
  it("keeps rewrites with real provenance, keeps skill-surfacing bullets, drops invented ones, computes coverage", () => {
    const t = validateTailored(profile, tags, {
      headline: "Cloud-focused IT student", summary: "Sum", skillsOrder: ["AWS", "Python", "Kubernetes"],
      experience: [{ id: "e1", bullets: [
        { text: "Closed 300 ServiceNow tickets, automating triage with Python scripts", from: "Resolved 300 tickets in ServiceNow" },
        { text: "Deployed a lab inventory tool on AWS", from: "skill: AWS" },
        { text: "Led a team of 12 engineers", from: "Managed the department" },
      ] }],
      gapPlan: [{ gap: "kubernetes", kind: "quick_project", advice: "Run a two-node cluster in a weekend." }],
    });
    expect(t.experience[0].after.map((b) => b.kind)).toEqual(["rewrite", "skill"]);
    expect(t.experience[0].after[1].from).toBe("AWS");
    expect(t.skillsOrder).toEqual(["AWS", "Python"]);          // Kubernetes isn't on the profile
    expect(t.coverage.before).toBe(Math.round(100 * 2.5 / 2.5)); // python + aws + servicenow already in profile text
    expect(t.coverage.after).toBe(100);
    expect(t.text).toContain("Deployed a lab inventory tool on AWS");
    expect(t.text).not.toContain("Led a team");
  });
});
