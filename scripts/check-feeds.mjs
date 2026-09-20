// Live smoke test of the ATS adapters. Needs open network (the dev sandbox blocks these hosts).
// Run: npx tsx scripts/check-feeds.mjs   -> prints job counts per company from data/companies.json (first N per ATS)
import { readFileSync } from "node:fs";
process.env.RAILS_MAX_JOBS ??= "25";
process.env.RAILS_LIST_ONLY ??= "1"; // list calls only; set RAILS_LIST_ONLY=0 to also fetch descriptions // Workday/SmartRecruiters do one request per posting; cap it for the smoke test
console.log("checking feeds (max %s postings per company)...", process.env.RAILS_MAX_JOBS);
const { fetchCompanyJobs } = await import("../src/lib/ats/index.ts");
const companies = JSON.parse(readFileSync("data/companies.json", "utf8"));
const perAts = Number(process.argv[2] ?? 2);
const ORDER = ["greenhouse", "lever", "ashby", "smartrecruiters", "workday", "workable", "jobvite", "icims", "oracle"];
const ONLY = process.argv[3] ? process.argv[3].split(",") : null; // e.g. npx tsx scripts/check-feeds.mjs 3 workable,jobvite,icims,oracle
const seen = {};
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`company timeout after ${ms / 1000}s`)), ms))]);
for (const c of [...companies].sort((a, b) => ORDER.indexOf(a.ats) - ORDER.indexOf(b.ats))) {
  if (ONLY && !ONLY.includes(c.ats)) continue;
  if (!ORDER.includes(c.ats) || (!c.slug && !(c.ats === "oracle" && c.careersUrl)) || (seen[c.ats] ?? 0) >= perAts) continue;
  seen[c.ats] = (seen[c.ats] ?? 0) + 1;
  const t = Date.now();
  process.stdout.write(`${c.ats.padEnd(15)} ${c.name.padEnd(28)} ...`);
  try {
    const jobs = await withTimeout(fetchCompanyJobs(c), 45_000);
    console.log(`\r${c.ats.padEnd(15)} ${c.name.padEnd(28)} ${String(jobs.length).padStart(5)} jobs  ${Date.now() - t}ms  e.g. ${jobs[0]?.title ?? "-"}`);
  } catch (e) {
    console.log(`\r${c.ats.padEnd(15)} ${c.name.padEnd(28)} ERROR ${e.message}${e.cause ? " / " + (e.cause.code ?? e.cause.message ?? "") : ""}`);
  }
}
