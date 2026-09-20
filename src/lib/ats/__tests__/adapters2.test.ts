import { describe, expect, it } from "vitest";
import { workable } from "../workable";
import { jobvite, parseJobviteList, parseJobviteDetail } from "../jobvite";
import { icims, parseIcimsList, parseIcimsDetail } from "../icims";
import { oracle } from "../oracle";
import type { FetchLike } from "../types";

// Fixtures follow each vendor's observed response shape. LIVE CHECK STILL REQUIRED: npx tsx scripts/check-feeds.mjs on an open network.
const fake = (routes: Record<string, unknown>): FetchLike => async (url, init) => {
  const key = Object.keys(routes).filter((k) => url.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  if (!key) return new Response("not found", { status: 404 });
  const body = routes[key];
  const v = typeof body === "function" ? (body as (i?: RequestInit) => unknown)(init) : body;
  return typeof v === "string" ? new Response(v, { status: 200, headers: { "content-type": "text/html" } }) : new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });
};

describe("workable", () => {
  it("pages with the token, enriches from v2, builds the apply URL", async () => {
    const f = fake({
      "https://apply.workable.com/api/v3/accounts/acme/jobs": (init?: RequestInit) => {
        const b = JSON.parse(String(init?.body ?? "{}"));
        return b.token ? { results: [{ shortcode: "B2", title: "Data Analyst", published: "2026-09-02T00:00:00Z", location: { city: "Austin", region: "TX", country: "United States", workplaceType: "hybrid" } }], nextPage: null }
          : { results: [{ shortcode: "A1", title: "SWE Intern", published: "2026-09-01T00:00:00Z", remote: true, location: { city: "Reston", region: "VA", country: "United States" }, department: "Eng", type: "Internship" }], nextPage: "tok2" };
      },
      "https://apply.workable.com/api/v2/accounts/acme/jobs/A1": { description: "<p>Build.</p>", requirements: "<ul><li>Python</li></ul>" },
      "https://apply.workable.com/api/v2/accounts/acme/jobs/B2": { description: "<p>Analyze.</p>" },
    });
    const jobs = await workable.fetchJobs({ name: "Acme", ats: "workable", slug: "acme" }, f);
    expect(jobs.map((j) => j.externalId)).toEqual(["A1", "B2"]);
    expect(jobs[0]).toMatchObject({ title: "SWE Intern", location: "Reston, VA, United States", remote: true, employmentType: "Internship", url: "https://apply.workable.com/acme/j/A1/" });
    expect(jobs[0].descriptionText).toContain("Requirements");
    expect(jobs[1].remote).toBe(false);
    const listOnly = await workable.fetchJobs({ name: "Acme", ats: "workable", slug: "acme" }, f, { listOnly: true, maxJobs: 1 });
    expect(listOnly).toHaveLength(1); expect(listOnly[0].descriptionText).toBeNull();
  });
});

const JV_LIST = `<table class="jv-job-list"><tr><td class="jv-job-list-name"><a href="/tylertech/job/oGxSjfwZ">Software Engineer I</a></td><td class="jv-job-list-location">Plano, Texas</td></tr>
<tr><td class="jv-job-list-name"><a href="https://jobs.jobvite.com/tylertech/job/abc123XY?nl=1">Remote QA Analyst</a></td><td class="jv-job-list-location">Remote</td></tr>
<tr><td><a href="/tylertech/jobs?foo">Search again</a></td></tr></table>`;
const JV_DETAIL = `<html><body><div class="jv-job-detail-description"><p>Tyler builds public-sector software.</p><ul><li>Java</li><li>SQL</li></ul></div><div class="jv-job-detail-meta">x</div></body></html>`;

describe("jobvite", () => {
  it("parses the listing table", () => {
    const rows = parseJobviteList("tylertech", JV_LIST);
    expect(rows).toEqual([{ id: "oGxSjfwZ", title: "Software Engineer I", location: "Plano, Texas" }, { id: "abc123XY", title: "Remote QA Analyst", location: "Remote" }]);
  });
  it("parses the detail block and maps rows", async () => {
    expect(parseJobviteDetail(JV_DETAIL).text).toContain("Java");
    const f = fake({ "https://jobs.jobvite.com/tylertech/jobs": JV_LIST, "https://jobs.jobvite.com/tylertech/job/": JV_DETAIL });
    const jobs = await jobvite.fetchJobs({ name: "Tyler", ats: "jobvite", slug: "tylertech" }, f);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({ externalId: "oGxSjfwZ", url: "https://jobs.jobvite.com/tylertech/job/oGxSjfwZ", applyUrl: "https://jobs.jobvite.com/tylertech/job/oGxSjfwZ/apply", remote: false });
    expect(jobs[0].descriptionText).toContain("SQL");
    expect(jobs[1].remote).toBe(true);
  });
});

const IC_LIST = `<div class="row"><a class="iCIMS_Anchor" href="https://careers-gdms.icims.com/jobs/61789/senior-software-engineer/job?mode=job&iis=Job+Board"><h3>Senior Software Engineer</h3></a>
<div class="col-xs-6 header left"><span>Job Locations</span></div><div class="col-xs-6 header right"><span>US-VA-Fairfax</span></div>
<div class="col-xs-6 header left"><span>Posted Date</span></div><div class="col-xs-6 header right"><span>2 weeks ago(9/5/2026 10:00 AM)</span></div></div>
<div class="row"><a href="https://careers-gdms.icims.com/jobs/61790/cyber-intern/job"><h3>Cyber Intern</h3></a><div><span>Job Locations</span></div><div><span>US-AZ-Scottsdale</span></div></div>
<a href="https://careers-gdms.icims.com/jobs/61789/senior-software-engineer/job">dup</a><a href="https://careers-gdms.icims.com/jobs/search?ss=1&pr=1">Next</a>`;
const IC_DETAIL = `<html><script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting","title":"Senior Software Engineer","datePosted":"2026-09-05","description":"<p>Design mission systems.</p><ul><li>C++</li></ul>","employmentType":"FULL_TIME","jobLocation":{"@type":"Place","address":{"addressLocality":"Fairfax","addressRegion":"VA","addressCountry":"US"}}}</script></html>`;

describe("icims", () => {
  it("parses the search page rows and dedupes", () => {
    const rows = parseIcimsList(IC_LIST);
    expect(rows.map((r) => r.id)).toEqual(["61789", "61790"]);
    expect(rows[0]).toMatchObject({ title: "Senior Software Engineer", location: "US-VA-Fairfax" });
    expect(rows[0].posted?.slice(0, 10)).toBe("2026-09-05");
  });
  it("reads JSON-LD on the job page and maps rows", async () => {
    const d = parseIcimsDetail(IC_DETAIL);
    expect(d.text).toContain("C++"); expect(d.location).toBe("Fairfax, VA, US"); expect(d.employmentType).toBe("FULL_TIME");
    const f = fake({ "https://careers-gdms.icims.com/jobs/search?ss=1&pr=0": IC_LIST, "https://careers-gdms.icims.com/jobs/search?ss=1&pr=1": "<html>no rows</html>", "https://careers-gdms.icims.com/jobs/61789/": IC_DETAIL, "https://careers-gdms.icims.com/jobs/61790/": "<html></html>" });
    const jobs = await icims.fetchJobs({ name: "GDMS", ats: "icims", slug: "careers-gdms" }, f);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({ externalId: "61789", location: "Fairfax, VA, US", employmentType: "FULL_TIME" });
    expect(jobs[1].descriptionText).toBeNull();
  });
});

describe("oracle recruiting cloud", () => {
  it("lists requisitions, enriches details, builds candidate-experience URLs", async () => {
    const f = fake({
      "https://egug.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions": { items: [{ TotalJobsCount: 1, requisitionList: [{ Id: "26001234", Title: "Software Engineer II", PostedDate: "2026-09-03", PrimaryLocation: "Phoenix, AZ, United States", ShortDescriptionStr: "<p>Short.</p>", WorkplaceType: "Hybrid", JobFamily: "Technology" }] }] },
      "https://egug.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails": { items: [{ Id: "26001234", Title: "Software Engineer II", ExternalDescriptionStr: "<p>Long description.</p>", ExternalQualificationsStr: "<ul><li>Java</li></ul>", WorkerType: "Employee" }] },
    });
    const jobs = await oracle.fetchJobs({ name: "Amex", ats: "oracle", slug: null, careersUrl: "https://egug.fa.us2.oraclecloud.com" }, f);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ externalId: "26001234", location: "Phoenix, AZ, United States", remote: false, employmentType: "Employee", url: "https://egug.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/26001234" });
    expect(jobs[0].descriptionText).toContain("Qualifications");
    expect(await oracle.fetchJobs({ name: "X", ats: "oracle", slug: null }, f)).toEqual([]);
  });
});
