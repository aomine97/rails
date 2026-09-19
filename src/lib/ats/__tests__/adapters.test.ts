import { describe, expect, it } from "vitest";
import { ashby } from "../ashby";
import { greenhouse } from "../greenhouse";
import { lever } from "../lever";
import { smartrecruiters } from "../smartrecruiters";
import { parsePostedOn, workday } from "../workday";
import { htmlToText, isRemote } from "../util";
import type { FetchLike } from "../types";

// Fixtures follow each vendor's documented response shape. LIVE CHECK STILL REQUIRED: run scripts/check-feeds.mjs on a machine with open network.
const fake = (routes: Record<string, unknown>): FetchLike => async (url, init) => {
  const key = Object.keys(routes).filter((k) => url.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  if (!key) return new Response("not found", { status: 404 });
  const body = routes[key];
  return new Response(JSON.stringify(typeof body === "function" ? (body as (i?: RequestInit) => unknown)(init) : body), { status: 200, headers: { "content-type": "application/json" } });
};

describe("greenhouse", () => {
  it("maps jobs and unescapes content", async () => {
    const f = fake({ "https://boards-api.greenhouse.io/v1/boards/acme/jobs": { jobs: [
      { id: 123, title: "SWE Intern", updated_at: "2026-09-01T10:00:00-04:00", absolute_url: "https://job-boards.greenhouse.io/acme/jobs/123", location: { name: "McLean, VA" }, departments: [{ name: "Engineering" }], content: "&lt;p&gt;Build things &amp; ship.&lt;/p&gt;" },
    ] } });
    const jobs = await greenhouse.fetchJobs({ name: "Acme", ats: "greenhouse", slug: "acme" }, f);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ externalId: "123", title: "SWE Intern", location: "McLean, VA", department: "Engineering", remote: false, descriptionText: "Build things & ship." });
    expect(jobs[0].descriptionHtml).toBe("<p>Build things & ship.</p>");
    expect(jobs[0].postedAt).toBe("2026-09-01T14:00:00.000Z");
  });
  it("throws with status on a bad board token", async () => {
    await expect(greenhouse.fetchJobs({ name: "X", ats: "greenhouse", slug: "nope" }, fake({}))).rejects.toMatchObject({ status: 404 });
  });
});

describe("lever", () => {
  it("maps postings, lists and workplaceType", async () => {
    const f = fake({ "https://api.lever.co/v0/postings/appian": [
      { id: "abc", text: "Software Engineer, New Grad", hostedUrl: "https://jobs.lever.co/appian/abc", applyUrl: "https://jobs.lever.co/appian/abc/apply", createdAt: 1756728000000,
        categories: { location: "McLean, VA", team: "Engineering", commitment: "Full-time" }, workplaceType: "hybrid",
        description: "<p>Intro</p>", descriptionPlain: "Intro", lists: [{ text: "Requirements", content: "<li>Java</li><li>SQL</li>" }] },
    ] });
    const [j] = await lever.fetchJobs({ name: "Appian", ats: "lever", slug: "appian" }, f);
    expect(j).toMatchObject({ externalId: "abc", remote: false, employmentType: "Full-time", department: "Engineering", applyUrl: "https://jobs.lever.co/appian/abc/apply" });
    expect(j.descriptionText).toContain("Requirements");
    expect(j.descriptionText).toContain("Java");
  });
});

describe("ashby", () => {
  it("maps jobs with compensation", async () => {
    const f = fake({ "https://api.ashbyhq.com/posting-api/job-board/ramp": { jobs: [
      { id: "u1", title: "Data Analyst Intern", department: "Data", employmentType: "Intern", location: "New York", isRemote: true, publishedAt: "2026-09-10T00:00:00Z", jobUrl: "https://jobs.ashbyhq.com/ramp/u1", descriptionHtml: "<p>Hi</p>",
        compensation: { summaryComponents: [{ compensationType: "Salary", minValue: 40, maxValue: 48, currencyCode: "USD", interval: "1 HOUR" }] } },
    ] } });
    const [j] = await ashby.fetchJobs({ name: "Ramp", ats: "ashby", slug: "ramp" }, f);
    expect(j).toMatchObject({ remote: true, employmentType: "Intern", descriptionText: "Hi", pay: { min: 40, max: 48, currency: "USD", period: "hour" } });
  });
});

describe("smartrecruiters", () => {
  it("pages the list and pulls detail", async () => {
    const f = fake({
      "https://api.smartrecruiters.com/v1/companies/Bosch/postings": { totalFound: 1, content: [{ id: "p1", name: "IT Intern", releasedDate: "2026-09-01T00:00:00.000Z", ref: "https://api.smartrecruiters.com/v1/companies/Bosch/postings/p1", location: { city: "Fairfax", region: "VA", country: "us", remote: false }, typeOfEmployment: { label: "Intern" } }] },
      "https://api.smartrecruiters.com/v1/companies/Bosch/postings/p1": { applyUrl: "https://jobs.smartrecruiters.com/Bosch/p1?apply", postingUrl: "https://jobs.smartrecruiters.com/Bosch/p1", jobAd: { sections: { jobDescription: { title: "Job Description", text: "<p>Do IT.</p>" } } } },
    });
    const [j] = await smartrecruiters.fetchJobs({ name: "Bosch", ats: "smartrecruiters", slug: "Bosch" }, f);
    expect(j).toMatchObject({ externalId: "p1", location: "Fairfax, VA, us", applyUrl: "https://jobs.smartrecruiters.com/Bosch/p1?apply" });
    expect(j.descriptionText).toContain("Do IT.");
  });
});

describe("workday", () => {
  it("posts to the cxs list endpoint and reads detail", async () => {
    const f = fake({
      "https://bah.wd1.myworkdayjobs.com/wday/cxs/bah/bah_jobs/jobs": (init?: RequestInit) => {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toMatchObject({ appliedFacets: {}, limit: 20, offset: 0 });
        return { total: 1, jobPostings: [{ title: "Software Engineer Intern", externalPath: "/job/McLean-VA/Software-Engineer-Intern_R0249225", locationsText: "McLean, VA", postedOn: "Posted 3 Days Ago" }] };
      },
      "https://bah.wd1.myworkdayjobs.com/wday/cxs/bah/bah_jobs/job/McLean-VA/Software-Engineer-Intern_R0249225": { jobPostingInfo: { title: "Software Engineer Intern", jobDescription: "<p>Clearance sponsored.</p>", location: "McLean, VA", postedOn: "Posted 3 Days Ago", timeType: "Full time", jobReqId: "R0249225", externalUrl: "https://bah.wd1.myworkdayjobs.com/bah_jobs/job/McLean-VA/Software-Engineer-Intern_R0249225" } },
    });
    const [j] = await workday.fetchJobs({ name: "Booz Allen", ats: "workday", slug: "bah_jobs", tenant: "bah", wdn: 1 }, f);
    expect(j).toMatchObject({ externalId: "R0249225", location: "McLean, VA", employmentType: "Full time", descriptionText: "Clearance sponsored." });
    expect(j.url).toContain("/bah_jobs/job/");
  });
  it("parses relative postedOn", () => {
    const now = new Date("2026-09-19T12:00:00Z");
    expect(parsePostedOn("Posted Today", now)).toBe("2026-09-19T12:00:00.000Z");
    expect(parsePostedOn("Posted 3 Days Ago", now)).toBe("2026-09-16T12:00:00.000Z");
    expect(parsePostedOn("Posted 30+ Days Ago", now)).toBe("2026-08-20T12:00:00.000Z");
  });
});

describe("util", () => {
  it("htmlToText keeps line breaks", () => {
    expect(htmlToText("<ul><li>A</li><li>B &amp; C</li></ul>")).toBe("A\nB & C");
  });
  it("isRemote", () => {
    expect(isRemote("Remote - US")).toBe(true);
    expect(isRemote("McLean, VA")).toBe(false);
    expect(isRemote(null)).toBe(null);
  });
});
