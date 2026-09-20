import { describe, expect, it } from "vitest";
import { normalizeParsed, ym, type Parsed } from "../parse";

describe("ym", () => {
  it("normalizes date strings", () => {
    expect(ym("Aug 2025")).toBe("2025-08"); expect(ym("2025-8")).toBe("2025-08"); expect(ym("08/2025")).toBe("2025-08");
    expect(ym("Present")).toBe(null); expect(ym("May 2027")).toBe("2027-05"); expect(ym(null)).toBe(null);
  });
});

describe("normalizeParsed", () => {
  it("builds a canonical profile with keys, ids, sources and cert-as-skill", () => {
    const p: Parsed = {
      name: "Maya Patel", email: "MP@email.vccs.edu", phone: null, address: { street: null, city: null, state: null, zip: null }, links: { linkedin: null, github: "github.com/maya", portfolio: null },
      headline: null, targetRoles: ["Software Engineer Intern"],
      skills: [{ name: "Python", level: "strong", evidence: "Built a Flask API" }, { name: "python", level: "familiar", evidence: null }, { name: "Node.js", level: "working", evidence: null }],
      experience: [{ title: "IT Help Desk Student Assistant", org: "NOVA", kind: "job", start: "Aug 2025", end: "Present", bullets: ["Reset 300+ passwords ", ""], skills: ["Active Directory"] }],
      education: [{ school: "NOVA", degree: "AAS", field: "IST, Cloud Computing", gradYear: 2027, startYear: null, gpa: 3.6, coursework: ["Java Programming"] }],
      certifications: [{ name: "AWS Cloud Practitioner", year: 2026 }],
      workAuthorization: "unknown", clearance: "none", locations: ["Annandale, VA"],
    };
    const c = normalizeParsed(p, "fallback@x.edu");
    expect(c.email).toBe("mp@email.vccs.edu");
    expect(c.skills.map((s) => s.key)).toEqual(["python", "nodejs", "aws-ccp"]);
    expect(c.experience[0]).toMatchObject({ id: "e1", start: "2025-08", end: null, bullets: ["Reset 300+ passwords."], skills: ["activedirectory"], source: "resume" });
    expect(c.certifications[0].key).toBe("aws-ccp");
    expect(c.constraints.employmentTypes).toContain("internship");
  });
});
