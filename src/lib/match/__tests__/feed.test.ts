import { describe, expect, it } from "vitest";
import { buildFeed, type FeedJobRow } from "../feed";
import type { CanonicalProfile } from "../../schemas/profile";

const profile: CanonicalProfile = {
  version: 1, name: "M", email: "m@x.edu", phone: null, links: { linkedin: null, github: null, portfolio: null }, headline: "software", targetRoles: ["Software Engineer Intern"],
  skills: [{ name: "Python", key: "python", level: "strong", source: "resume" }], experience: [], education: [{ school: "NOVA", degree: "AAS", field: "IST", gradYear: 2027, gpa: null, coursework: [], source: "resume" }], certifications: [],
  constraints: { workAuthorization: "us_citizen", clearance: "none", locations: [], maxCommuteMiles: null, remoteOk: true, employmentTypes: ["internship", "new_grad"], earliestStart: null, minPayHourly: null },
};
const base = { location: "McLean, VA", remote: false, url: "u", apply_url: "a", posted_at: "2026-09-19T00:00:00Z", first_seen_at: new Date().toISOString(), pay_min: null, pay_max: null, pay_period: null, companies: { name: "Acme", ats: "lever" } };
const tags = (o: Record<string, unknown>) => ({ level: "internship", field: "software", requiredSkills: ["python"], preferredSkills: [], requirements: [], minDegree: "none", yearsMin: 0, clearanceRequired: "none", usCitizenRequired: null, sponsorship: "unknown", remote: "onsite", employmentType: "internship", payMinHourly: null, payMaxHourly: null, hasOnlineAssessment: null, ...o });
const rows: FeedJobRow[] = [
  { id: "1", title: "SWE Intern", tags: tags({}), ...base },
  { id: "6", title: "SWE Intern", tags: tags({}), ...base, location: "Hong Kong" },
  { id: "7", title: "SWE Intern", tags: tags({}), ...base, location: "Plano, TX" },
  { id: "2", title: "Senior Engineer", tags: tags({ level: "senior" }), ...base },
  { id: "3", title: "Data Analyst Intern", tags: tags({ field: "data", requiredSkills: ["sql"] }), ...base },
  { id: "4", title: "Entry IT", tags: tags({ level: "entry" }), ...base },
  { id: "5", title: "Untagged", tags: null, ...base },
];

describe("buildFeed", () => {
  it("drops untagged and unwanted levels; ranks by fit; counts new", () => {
    const f = buildFeed(profile, rows);
    expect(f.items.map((i) => i.job.id)).toEqual(["1", "3"]);
    expect(f.items[0].score.fit).toBeGreaterThan(f.items[1].score.fit);
    expect(f.newToday).toBe(2);
  });
  it("filters by field and search", () => {
    expect(buildFeed(profile, rows, { field: "data" }).items.map((i) => i.job.id)).toEqual(["3"]);
    expect(buildFeed(profile, rows, { q: "swe" }).items.map((i) => i.job.id)).toEqual(["1"]);
  });
  it("hides international by default, groups same title across cities, allows anywhere", () => {
    const us = buildFeed(profile, rows);
    const swe = us.items.find((i) => i.job.title === "SWE Intern")!;
    expect(swe.job.location).toBe("McLean, VA");           // DMV wins the group
    expect(swe.otherLocations).toEqual(["Plano, TX"]);      // Hong Kong never entered
    expect(buildFeed(profile, rows, { where: "anywhere" }).items.find((i) => i.job.title === "SWE Intern")!.otherLocations).toContain("Hong Kong");
    expect(buildFeed(profile, rows, { where: "dmv" }).items.map((i) => i.job.title)).toEqual(["SWE Intern", "Data Analyst Intern"]);
  });
});
