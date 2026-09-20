import { describe, expect, it, vi } from "vitest";
import { pickAlertJobs } from "../pick";
import { renderAlert } from "../email";
import { sendEmail } from "../send";
import type { CanonicalProfile } from "../../schemas/profile";
import type { FeedJobRow } from "../../match/feed";

const profile: CanonicalProfile = {
  version: 1, name: "Maya Patel", email: "maya@example.edu", phone: null, links: { linkedin: null, github: null, portfolio: null },
  headline: "Cloud student", targetRoles: ["Software Engineer Intern"],
  skills: [{ name: "Python", key: "python", level: "strong", source: "resume" }, { name: "SQL", key: "sql", level: "working", source: "resume" }, { name: "AWS", key: "aws", level: "working", source: "resume" }],
  experience: [{ id: "e1", title: "IT Intern", org: "Inova", kind: "internship", start: "2026-06", end: "2026-08", bullets: ["Resolved 300 tickets"], skills: ["python"], source: "resume" }],
  education: [{ school: "NOVA", degree: "AAS", field: "IST", gradYear: 2028, gpa: null, coursework: [], source: "resume" }], certifications: [],
  constraints: { workAuthorization: "us_citizen", clearance: "none", workCountries: [], locations: ["McLean, VA"], maxCommuteMiles: null, remoteOk: true, employmentTypes: ["internship", "new_grad", "entry"], earliestStart: null, minPayHourly: null },
};
const tags = (over: Record<string, unknown> = {}) => ({ level: "internship", field: "software", requiredSkills: ["python", "sql"], preferredSkills: ["aws"], requirements: [], minDegree: "unknown", yearsMin: 0, clearanceRequired: "none", usCitizenRequired: null, sponsorship: "unknown", remote: "hybrid", employmentType: "internship", payMinHourly: null, payMaxHourly: null, hasOnlineAssessment: null, summary: "Build things.", relocationOffered: null, country: "US", ...over });
const row = (id: string, first: string, over: Partial<FeedJobRow> = {}): FeedJobRow => ({ id, title: "SWE Intern", location: "Reston, VA", remote: false, url: "u", apply_url: "u", posted_at: null, first_seen_at: first, tags: tags(), pay_min: null, pay_max: null, pay_period: null, companies: { name: "Acme", ats: "greenhouse" }, ...over });

describe("pickAlertJobs", () => {
  const now = new Date("2026-09-20T12:00:00Z");
  it("keeps only new, unhidden, in-area jobs above the floor", () => {
    const rows = [
      row("new-good", "2026-09-20T10:00:00Z"),
      row("old", "2026-09-18T10:00:00Z"),
      row("hidden", "2026-09-20T11:00:00Z"),
      row("weak", "2026-09-20T11:00:00Z", { tags: tags({ requiredSkills: ["rust", "go", "kubernetes"], field: "hardware" }) }),
      row("abroad", "2026-09-20T11:00:00Z", { location: "London, UK", tags: tags({ country: "GB" }) }),
    ];
    const out = pickAlertJobs(profile, rows, { since: "2026-09-19T12:00:00Z", minFit: 80, where: "us", hidden: new Set(["hidden"]) }, now);
    expect(out.map((i) => i.job.id)).toEqual(["new-good"]);
  });
});

describe("renderAlert", () => {
  it("puts the number, the title and the links in both bodies", () => {
    const item = pickAlertJobs(profile, [row("j1", "2026-09-20T10:00:00Z")], { since: "2026-09-19T00:00:00Z", minFit: 50, where: "us" }, new Date("2026-09-20T12:00:00Z"))[0];
    const m = renderAlert({ name: "Maya Patel", items: [item], kind: "digest", siteUrl: "https://rails.test", unsubscribeUrl: "https://rails.test/u?t=x" });
    expect(m.subject).toContain(`top fit ${item.score.fit}`);
    expect(m.html).toContain("https://rails.test/app/jobs/j1"); expect(m.html).toContain("Maya,"); expect(m.html).toContain("Unsubscribe");
    expect(m.text).toContain(`${item.score.fit}  SWE Intern`);
  });
});

describe("sendEmail", () => {
  it("posts to Resend with the bearer and returns the id", async () => {
    process.env.RESEND_API_KEY = "re_test"; process.env.ALERTS_FROM = "Rails <alerts@rails.test>";
    const f = vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify({ id: "em_1", body: init?.body }), { status: 200 }));
    const id = await sendEmail("maya@example.edu", { subject: "s", html: "<p>h</p>", text: "t" }, f as unknown as typeof fetch);
    expect(id).toBe("em_1");
    expect((f.mock.calls[0][1]?.headers as Record<string, string>).authorization).toBe("Bearer re_test");
    const bad = vi.fn(async () => new Response("nope", { status: 422 }));
    await expect(sendEmail("x@y.z", { subject: "s", html: "", text: "" }, bad as unknown as typeof fetch)).rejects.toThrow("resend 422");
  });
});
