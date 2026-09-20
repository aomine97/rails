// Live smoke test of the ATS adapters. Needs open network (the dev sandbox blocks these hosts).
// Run: npx tsx scripts/check-feeds.mjs   -> prints job counts per company from data/companies.json (first N per ATS)
import { readFileSync } from "node:fs";
process.env.RAILS_MAX_JOBS ??= "25"; // Workday/SmartRecruiters do one request per posting; cap it for the smoke test
console.log("checking feeds (max %s postings per company)...", process.env.RAILS_MAX_JOBS);
const { fetchCompanyJobs } = await import("../src/lib/ats/index.ts");
const companies = JSON.parse(readFileSync("data/companies.json", "utf8"));
const perAts = Number(process.argv[2] ?? 2);
const seen = {};
for (const c of companies) {
  if (!c.slug || (seen[c.ats] ?? 0) >= perAts) continue;
  seen[c.ats] = (seen[c.ats] ?? 0) + 1;
  const t = Date.now();
  process.stdout.write(`${c.ats.padEnd(15)} ${c.name.padEnd(28)} ...`);
  try {
    const jobs = await fetchCompanyJobs(c);
    console.log(`\r${c.ats.padEnd(15)} ${c.name.padEnd(28)} ${String(jobs.length).padStart(5)} jobs  ${Date.now() - t}ms  e.g. ${jobs[0]?.title ?? "-"}`);
  } catch (e) {
    console.log(`\r${c.ats.padEnd(15)} ${c.name.padEnd(28)} ERROR ${e.message}`);
  }
}
