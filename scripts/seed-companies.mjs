// Builds data/companies.json from the SimplifyJobs / vanshb03 GitHub lists plus a hand-kept DC list.
// Run: node scripts/seed-companies.mjs   (needs network to raw.githubusercontent.com only)
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";

const SOURCES = [
  "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README.md",
  "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/README.md",
  "https://raw.githubusercontent.com/vanshb03/New-Grad-2027/dev/README.md",
  "https://raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/README.md",
];

// Hand-kept DC / NoVA employers. ats/slug filled by the lists when they appear there, else left for the resolver.
const DC_LIST = [
  "Capital One", "Booz Allen Hamilton", "Leidos", "SAIC", "CACI", "Peraton", "MITRE", "Northrop Grumman",
  "General Dynamics Information Technology", "Amazon", "Amazon Web Services", "Microsoft", "Deloitte",
  "Accenture Federal Services", "Freddie Mac", "Fannie Mae", "Navy Federal Credit Union", "Appian", "Cvent",
  "Bank of America", "ManTech", "Raytheon", "Lockheed Martin", "Johns Hopkins APL", "Verizon", "Hilton",
  "Marriott", "Mastercard", "Capital One Software", "Bloomberg Industry Group", "Carahsoft", "IronNet",
  "Cloudflare", "Databricks", "Palantir", "Anduril", "Rebellion Defense", "ID.me", "Cerner", "ScienceLogic",
];

/** Map an apply URL to {ats, slug}. slug null = known ATS but slug not derivable from URL (resolver fixes later). */
export function detectAts(url) {
  let u;
  try { u = new URL(url); } catch { return { ats: "unknown", slug: null }; }
  const h = u.hostname.toLowerCase();
  const p = u.pathname.split("/").filter(Boolean);
  const q = u.searchParams;
  if (h === "job-boards.greenhouse.io" || h === "boards.greenhouse.io" || h === "job-boards.eu.greenhouse.io")
    return { ats: "greenhouse", slug: p[0] ?? null };
  if (q.has("gh_jid") || h.endsWith("greenhouse.io")) return { ats: "greenhouse", slug: null };
  if (h === "jobs.lever.co") return { ats: "lever", slug: p[0] ?? null };
  if (h === "jobs.ashbyhq.com") return { ats: "ashby", slug: p[0] ?? null };
  if (h === "jobs.smartrecruiters.com") return { ats: "smartrecruiters", slug: p[0] ?? null };
  const wd = h.match(/^([a-z0-9-]+)\.wd(\d+)\.myworkdayjobs\.com$/);
  if (wd) {
    // /{locale?}/{site}/job/... or /{site}/...
    const locale = /^[a-z]{2}-[A-Z]{2}$/.test(p[0] ?? "") ? p.shift() : null;
    return { ats: "workday", slug: p[0] ?? null, tenant: wd[1], wdn: Number(wd[2]), locale };
  }
  if (h.endsWith(".icims.com")) return { ats: "icims", slug: h.split(".")[0] };
  if (h.includes("oraclecloud.com")) return { ats: "oracle", slug: null };
  if (h.endsWith(".workable.com") || h === "apply.workable.com") return { ats: "workable", slug: p[0] ?? null };
  if (h === "jobs.jobvite.com") return { ats: "jobvite", slug: p[0] ?? null };
  if (h.endsWith(".taleo.net")) return { ats: "taleo", slug: null };
  return { ats: "unknown", slug: null };
}

function cleanName(s) {
  return s.replace(/<[^>]+>/g, "").replace(/[\u{1F300}-\u{1FAFF}]|🔥|🎓|🛂|🇺🇸|↳/gu, "").replace(/\s+/g, " ").trim();
}

function parseReadme(md) {
  const rows = [];
  const re = /<tr>([\s\S]*?)<\/tr>/g;
  let m; let lastCompany = null;
  while ((m = re.exec(md))) {
    const tds = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => x[1]);
    if (tds.length < 4) continue;
    let company = cleanName(tds[0]);
    if (!company || company === "↳") company = lastCompany; else lastCompany = company;
    const role = cleanName(tds[1]);
    const location = cleanName(tds[2]);
    const apply = [...tds[3].matchAll(/href="([^"]+)"/g)].map((x) => x[1]).find((l) => !l.includes("simplify.jobs"));
    if (!company || !apply) continue;
    rows.push({ company, role, location, apply });
  }
  return rows;
}

async function main() {
  const byCompany = new Map();
  const add = (name, info = {}) => {
    const key = name.toLowerCase();
    const cur = byCompany.get(key) ?? { name, ats: "unknown", slug: null, careersUrl: null, sample: null, roles: 0 };
    // prefer a resolved slug over unknown
    const { apply, role, ...ats } = info;
    if (cur.ats === "unknown" && ats.ats && ats.ats !== "unknown") Object.assign(cur, ats);
    else if (cur.slug == null && ats.slug) Object.assign(cur, ats);
    if (info.apply && !cur.sample) cur.sample = info.apply;
    if (info.role) cur.roles += 1;
    byCompany.set(key, cur);
  };
  let total = 0;
  for (const src of SOURCES) {
    let md;
    try { md = await (await fetch(src)).text(); } catch (e) { console.error("skip", src, e.message); continue; }
    const rows = parseReadme(md);
    total += rows.length;
    for (const r of rows) {
      const d = detectAts(r.apply);
      add(r.company, { ...d, apply: r.apply, role: r.role, careersUrl: new URL(r.apply).origin });
    }
  }
  // DC list: only add names not already present (loose match on the first word pair)
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").slice(0, 2).join(" ");
  const present = new Set([...byCompany.keys()].map(norm));
  for (const n of DC_LIST) if (!present.has(norm(n))) add(n, {});
  const list = [...byCompany.values()].sort((a, b) => b.roles - a.roles || a.name.localeCompare(b.name));
  mkdirSync("data", { recursive: true });
  writeFileSync("data/companies.json", JSON.stringify(list, null, 2));
  const counts = {};
  for (const c of list) counts[c.ats] = (counts[c.ats] ?? 0) + 1;
  const resolvable = list.filter((c) => c.slug).length;
  console.log(`rows parsed: ${total}. companies: ${list.length}. with slug: ${resolvable}.`, counts);
}
main();
