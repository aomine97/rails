import { describe, expect, it } from "vitest";
import { scoreResume } from "../score";
import type { CanonicalProfile } from "../../schemas/profile";

const base: CanonicalProfile = {
  version: 1, name: "M", email: "m@x.edu", phone: "5", links: { linkedin: "l", github: "g", portfolio: null }, headline: "IT student", targetRoles: ["SWE Intern"],
  skills: Array.from({ length: 12 }, (_, i) => ({ name: `S${i}`, key: `s${i}`, level: "working" as const, evidence: i < 8 ? "used" : undefined, source: "resume" as const })),
  experience: [
    { id: "e1", title: "Help Desk", org: "NOVA", kind: "job", start: "2025-08", end: null, bullets: ["Resolved 300 tickets in ServiceNow", "Imaged 40 lab machines a week"], skills: [], source: "resume" },
    { id: "e2", title: "Inventory app", org: "Personal", kind: "project", start: null, end: null, bullets: ["Built a Flask app used by 3 labs", "Cut lookup time by 50%"], skills: [], source: "resume" },
  ],
  education: [{ school: "NOVA", degree: "AAS", field: "IST", gradYear: 2027, gpa: null, coursework: [], source: "resume" }], certifications: [],
  constraints: { workAuthorization: "unknown", clearance: "none", locations: [], maxCommuteMiles: null, remoteOk: true, employmentTypes: ["internship"], earliestStart: null, minPayHourly: null },
};

describe("scoreResume", () => {
  it("scores a solid student resume high with few fixes", () => {
    const s = scoreResume(base);
    expect(s.total).toBeGreaterThanOrEqual(80);
    expect(s.bars).toHaveLength(6);
    expect(s.fixes.every((f) => f.points > 0)).toBe(true);
  });
  it("finds the classic problems and ranks by points", () => {
    const weak = { ...base, phone: null, links: { linkedin: null, github: null, portfolio: null }, skills: base.skills.slice(0, 4),
      experience: [{ ...base.experience[0], bullets: ["Responsible for helping customers", "Various duties"] }] };
    const s = scoreResume(weak);
    expect(s.total).toBeLessThan(50);
    expect(s.fixes[0].points).toBeGreaterThanOrEqual(s.fixes[1].points);
    expect(s.fixes.map((f) => f.title).join(" ")).toMatch(/number|project|skills|filler|phone/i);
  });
});
