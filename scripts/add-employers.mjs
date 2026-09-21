// Merge data/stem-employers.json (and data/marquee.json) into data/companies.json + data/domains.json so discover-companies can resolve them.
// Run: node scripts/add-employers.mjs && node --env-file=.env.local scripts/discover-companies.mjs --apply --only="$(node -e 'console.log(require("./data/stem-employers.json").companies.map(c=>c.name).join(","))')"
import { readFileSync, writeFileSync } from "node:fs";
const companies = JSON.parse(readFileSync("data/companies.json", "utf8"));
const domains = JSON.parse(readFileSync("data/domains.json", "utf8"));
const have = new Map(companies.map((c) => [c.name.toLowerCase(), c]));
let added = 0, doms = 0;
for (const file of ["data/stem-employers.json", "data/marquee.json"]) {
  for (const c of JSON.parse(readFileSync(file, "utf8")).companies) {
    if (!have.has(c.name.toLowerCase())) { companies.push({ name: c.name, ats: c.ats && c.ats !== "custom" ? c.ats : "unknown", slug: c.slug ?? null, careersUrl: c.careersUrl ?? null, sample: null, roles: 0 }); have.set(c.name.toLowerCase(), true); added++; }
    if (c.domain && !domains[c.name]) { domains[c.name] = c.domain; doms++; }
  }
}
writeFileSync("data/companies.json", JSON.stringify(companies, null, 2));
writeFileSync("data/domains.json", JSON.stringify(domains, null, 2));
console.log(`added ${added} companies, ${doms} domains -> now ${companies.length} companies`);
