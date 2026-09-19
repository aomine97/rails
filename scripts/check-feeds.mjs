// Live smoke test of the ATS adapters. Needs open network (the dev sandbox blocks these hosts).
// Run: npx tsx scripts/check-feeds.mjs   -> prints job counts per company from data/companies.json (first N per ATS)
import { readFileSync } from "node:fs";
const { fetchCompanyJobs } = await import("../src/lib/ats/index.ts");
const companies = JSON.parse(readFileSync("data/companies.json", "utf8"));
const perAts = Number(process.argv[2] ?? 2);
const seen = {};
for (const c of companies) {
  if (!c.slug || (seen[c.ats] ?? 0) >= perAts) continue;
  seen[c.ats] = (seen[c.ats] ?? 0) + 1;
  const t = Date.now();
  try {
    const jobs = await fetchCompanyJobs(c);
    console.log(`${c.ats.padEnd(15)} ${c.name.padEnd(28)} ${String(jobs.length).padStart(5)} jobs  ${Date.now() - t}ms  e.g. ${jobs[0]?.title ?? "-"}`);
  } catch (e) {
    console.log(`${c.ats.padEnd(15)} ${c.name.padEnd(28)} ERROR ${e.message}`);
  }
}
