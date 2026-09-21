import { describe, expect, it } from "vitest";
import { hostToName, parsePostingHtml } from "../paste";

describe("parsePostingHtml", () => {
  it("prefers JSON-LD JobPosting", () => {
    const html = `<html><head><title>Careers</title><script type="application/ld+json">{"@type":"JobPosting","title":"Software Engineer Intern","hiringOrganization":{"name":"Acme Corp"},"description":"<p>${"We build things. ".repeat(12)}</p>","url":"https://acme.com/apply/1"}</script></head><body>junk</body></html>`;
    const p = parsePostingHtml("https://acme.com/jobs/1", html);
    expect(p).toMatchObject({ title: "Software Engineer Intern", company: "Acme Corp", applyUrl: "https://acme.com/apply/1" });
    expect(p.text).toContain("We build things.");
  });
  it("falls back to og:title + main text", () => {
    const html = `<html><head><meta property="og:title" content="Data Analyst | Widgets"></head><body><nav>menu</nav><main><h1>Data Analyst</h1><p>Do analysis.</p></main></body></html>`;
    const p = parsePostingHtml("https://jobs.widgets.io/x", html);
    expect(p.title).toBe("Data Analyst"); expect(p.company).toBe("Widgets"); expect(p.text).toContain("Do analysis.");
  });
  it("names companies from ATS urls", () => {
    expect(hostToName("https://bah.wd1.myworkdayjobs.com/bah_jobs/job/x")).toBe("BAH"); // short slugs are acronyms (IBM, AMD, BAH)
    expect(hostToName("https://job-boards.greenhouse.io/ibm/jobs/1")).toBe("IBM");
    expect(hostToName("https://job-boards.greenhouse.io/spacex/jobs/1")).toBe("Spacex");
    expect(hostToName("https://jobs.lever.co/palantir/abc")).toBe("Palantir");
  });
});
