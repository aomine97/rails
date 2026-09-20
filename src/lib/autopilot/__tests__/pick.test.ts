import { describe, expect, it } from "vitest";
import { nightlyCap, pickAutopilot } from "../pick";
import type { CanonicalProfile } from "../../schemas/profile";
import type { FeedJobRow } from "../../match/feed";

const profile: CanonicalProfile = {
  version: 1, name: "Maya Patel", email: "maya@example.edu", phone: null, preferredName: null, address: { street: null, city: null, state: null, zip: null }, links: { linkedin: null, github: null, portfolio: null },
  headline: "Cloud student", targetRoles: ["Software Engineer Intern"],
  skills: [{ name: "Python", key: "python", level: "strong", source: "resume" }, { name: "SQL", key: "sql", level: "working", source: "resume" }, { name: "AWS", key: "aws", level: "working", source: "resume" }],
  experience: [{ id: "e1", title: "IT Intern", org: "Inova", kind: "internship", start: "2026-06", end: "2026-08", bullets: ["Resolved 300 tickets"], skills: ["python"], source: "resume" }],
  education: [{ school: "NOVA", degree: "AAS", field: "IST", gradYear: 2028, startYear: 2025, gpa: null, coursework: [], source: "resume" }], certifications: [],
  constraints: { workAuthorization: "us_citizen", clearance: "none", workCountries: [], locations: ["McLean, VA"], maxCommuteMiles: null, remoteOk: true, employmentTypes: ["internship", "new_grad", "entry"], earliestStart: null, minPayHourly: null },
};
const tags = (over: Record<string, unknown> = {}) => ({ level: "internship", field: "software", requiredSkills: ["python", "sql"], preferredSkills: ["aws"], requirements: [], minDegree: "unknown", yearsMin: 0, clearanceRequired: "none", usCitizenRequired: null, sponsorship: "unknown", remote: "hybrid", employmentType: "internship", payMinHourly: null, payMaxHourly: null, hasOnlineAssessment: null, summary: "", relocationOffered: null, country: "US", ...over });
const row = (id: string, company: string, first: string, over: Partial<FeedJobRow> = {}): FeedJobRow => ({ id, title: "SWE Intern", location: "Reston, VA", remote: false, url: "u", apply_url: "u", posted_at: null, first_seen_at: first, tags: tags(), pay_min: null, pay_max: null, pay_period: null, companies: { name: company, ats: "greenhouse" }, ...over });

describe("pickAutopilot", () => {
  const now = new Date("2026-09-21T06:00:00Z"); const since = now.getTime() - 24 * 3600_000;
  it("new, above floor, one per company, excludes queued/hidden/applied, capped", () => {
    const rows = [
      row("a", "Capital One", "2026-09-20T20:00:00Z"), row("b", "Capital One", "2026-09-20T21:00:00Z"),
      row("c", "Booz Allen", "2026-09-20T22:00:00Z"), row("old", "Leidos", "2026-09-18T10:00:00Z"),
      row("queued", "SAIC", "2026-09-20T23:00:00Z"), row("weak", "MITRE", "2026-09-20T23:00:00Z", { tags: tags({ requiredSkills: ["rust", "go", "k8s"], field: "hardware" }) }),
      row("d", "CACI", "2026-09-20T23:30:00Z"),
    ];
    const picks = pickAutopilot(profile, rows, { minFit: 80, where: "us", exclude: new Set(["queued"]), max: 2, sinceMs: since }, now);
    expect(picks.map((p) => p.job.id)).toEqual(["a", "c"]);
  });
  it("caps by plan", () => {
    expect(nightlyCap("free")).toEqual({ count: 10, prepare: false }); expect(nightlyCap("pro")).toEqual({ count: 10, prepare: true }); expect(nightlyCap("semester").count).toBe(20);
  });
});
