import { describe, expect, it } from "vitest";
import { bandOf, scoreJob } from "../score";
import type { CanonicalProfile } from "../../schemas/profile";
import type { JobTags } from "../../jobs/tags";

const profile: CanonicalProfile = {
  version: 1, name: "Maya Patel", email: "maya@example.edu", phone: null,
  links: { linkedin: null, github: "github.com/maya", portfolio: null },
  headline: "Cloud computing student, NOVA", targetRoles: ["Software Engineer Intern", "Cloud Support"],
  skills: [
    { name: "Python", key: "python", level: "strong", evidence: "Built a Flask API for a class project", source: "resume" },
    { name: "SQL", key: "sql", level: "working", source: "resume" },
    { name: "AWS", key: "aws", level: "working", source: "user" },
  ],
  experience: [
    { id: "e1", title: "IT Help Desk Intern", org: "Inova", kind: "internship", start: "2026-06", end: "2026-08", bullets: ["Resolved 300+ tickets in ServiceNow"], skills: ["servicenow"], source: "resume" },
    { id: "e2", title: "Server", org: "Wildfire", kind: "job", start: "2025-01", end: null, bullets: [], skills: [], source: "resume" },
  ],
  education: [{ school: "NOVA", degree: "AAS", field: "Information Systems Technology, Cloud Computing", gradYear: 2028, gpa: 3.6, coursework: ["Java Programming", "Networking"], source: "resume" }],
  certifications: [{ name: "AWS Cloud Practitioner", key: "aws-ccp", year: 2026, source: "resume" }],
  constraints: { workAuthorization: "us_citizen", clearance: "none", workCountries: [], locations: ["McLean, VA"], maxCommuteMiles: 30, remoteOk: true, employmentTypes: ["internship", "new_grad", "entry"], earliestStart: null, minPayHourly: null },
};

const base: JobTags = {
  level: "internship", field: "software", requiredSkills: ["python", "sql"], preferredSkills: ["aws", "react"],
  requirements: [{ text: "Proficiency in Python", required: true }, { text: "Experience with React", required: false }, { text: "Strong communication", required: true }],
  minDegree: "bachelor", yearsMin: 0, clearanceRequired: "none", usCitizenRequired: null, sponsorship: "unknown", remote: "hybrid",
  employmentType: "internship", payMinHourly: 40, payMaxHourly: 48, hasOnlineAssessment: true, summary: "", relocationOffered: null, country: "US",
};

describe("scoreJob", () => {
  it("scores a good internship match green-ish with evidence per requirement", () => {
    const s = scoreJob(profile, base, { title: "Software Engineer Intern", location: "McLean, VA" });
    expect(s.hardBlocks).toEqual([]);
    expect(s.fit).toBeGreaterThanOrEqual(70);
    expect(s.sub.skills).toBe(Math.round(30 + 70 * ((2 + 0.5) / 3)));
    expect(s.requirements[0]).toMatchObject({ status: "met", evidence: "Built a Flask API for a class project" });
    expect(s.requirements[1]).toMatchObject({ status: "missing" });
    expect(s.requirements[2]).toMatchObject({ status: "partial" });
    expect(s.missingPreferred).toEqual(["react"]);
  });
  it("caps fit and lists the reason when citizenship or clearance blocks", () => {
    const s = scoreJob({ ...profile, constraints: { ...profile.constraints, workAuthorization: "visa_needs_sponsorship" } },
      { ...base, usCitizenRequired: true, clearanceRequired: "secret" }, { title: "SWE I", location: "McLean, VA" });
    expect(s.hardBlocks).toEqual(["US citizenship required", "Active secret clearance required"]);
    expect(s.fit).toBeLessThanOrEqual(45);
    expect(s.band).toBe("stretch");
  });
  it("does not block on degree, only dampens field", () => {
    const a = scoreJob(profile, { ...base, minDegree: "none" }, { title: "SWE Intern", location: null });
    const b = scoreJob(profile, { ...base, minDegree: "bachelor" }, { title: "SWE Intern", location: null });
    expect(b.hardBlocks).toEqual([]);
    expect(b.sub.field).toBeLessThanOrEqual(a.sub.field);
  });
  it("counts certifications as skills", () => {
    const s = scoreJob(profile, { ...base, requiredSkills: ["aws-ccp"], preferredSkills: [] }, { title: "Cloud Support", location: null });
    expect(s.sub.skills).toBe(100);
  });
  it("bands", () => {
    expect(bandOf(85)).toBe("strong"); expect(bandOf(84)).toBe("good"); expect(bandOf(69)).toBe("stretch");
  });
});

describe("work authorization abroad", () => {
  it("caps a foreign job at amber with a note, never a block", () => {
    const s = scoreJob(profile, { ...base, country: "CA" }, { title: "SWE Intern", location: "Toronto, ON" });
    expect(s.hardBlocks).toEqual([]);
    expect(s.fit).toBeLessThanOrEqual(74);
    expect(s.softNotes[0]).toContain("Canada");
  });
  it("no cap when the profile lists that country or a location there", () => {
    const withCa = { ...profile, constraints: { ...profile.constraints, workCountries: ["CA"] } };
    expect(scoreJob(withCa, { ...base, country: "CA" }, { title: "x", location: "Toronto, ON" }).softNotes).toEqual([]);
    const livesThere = { ...profile, constraints: { ...profile.constraints, locations: ["Vancouver, Canada"] } };
    expect(scoreJob(livesThere, { ...base, country: "CA" }, { title: "x", location: "Vancouver, BC" }).softNotes).toEqual([]);
  });
  it("US and remote jobs are untouched", () => {
    expect(scoreJob(profile, base, { title: "x", location: "Reston, VA" }).softNotes).toEqual([]);
    expect(scoreJob(profile, { ...base, country: "REMOTE" }, { title: "x", location: "Remote" }).softNotes).toEqual([]);
  });
});
