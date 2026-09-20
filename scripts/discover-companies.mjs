// Company discovery: find the ATS + slug for companies we only know by name.
// 1) probe the public APIs with slug guesses (Greenhouse, Lever, Ashby, SmartRecruiters, Workable, iCIMS)
// 2) crawl the company site (homepage, /careers, /jobs, careers.<domain>) for ATS links, incl. Workday tenant+site
// Writes back to data/companies.json. `--apply` also updates the companies table (needs .env.local).
// Run: node --env-file=.env.local scripts/discover-companies.mjs [--apply] [--all] [--only="Name,Name"]
import { readFileSync, writeFileSync } from "node:fs";

const UA = "RailsJobs/0.1 (+https://rails.app; jobs@rails.app)";
const args = process.argv.slice(2);
const APPLY = args.includes("--apply"), ALL = args.includes("--all");
const ONLY = (args.find((a) => a.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean);
const companies = JSON.parse(readFileSync("data/companies.json", "utf8"));
const domains = JSON.parse(readFileSync("data/domains.json", "utf8"));

const slugify = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
function candidates(name, domain) {
  const words = slugify(name).split(" ").filter((w) => !["inc", "llc", "co", "corp", "corporation", "company", "the", "of", "group", "holdings", "technologies", "technology"].includes(w));
  const joined = words.join(""), dashed = words.join("-"), first = words[0] ?? "", acronym = words.map((w) => w[0]).join("");
  const dom = domain ? domain.split(".")[0] : null;
  return [...new Set([joined, dashed, first, dom, acronym.length >= 3 ? acronym : null, words.slice(0, 2).join(""), words.slice(0, 2).join("-")].filter((x) => x && x.length >= 3))];
}

async function get(url, init = {}, ms = 10_000) {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(ms), ...init, headers: { "user-agent": UA, accept: "application/json, text/html", ...(init.headers ?? {}) } });
    return res;
  } catch { return null; }
}
const okJson = async (res, check) => { if (!res || !res.ok) return false; try { return check(await res.json()); } catch { return false; } };

/** Does this tenant/slug/site plausibly belong to the company? Any name word (>=3 chars) or the domain base must appear. */
function resembles(name, domain, ...parts) {
  const hay = parts.filter(Boolean).join(" ").toLowerCase().replace(/[^a-z0-9]/g, "");
  const GENERIC = new Set(["inc", "llc", "the", "and", "group", "company", "corp", "corporation", "technologies", "technology", "holdings", "capital", "management", "services", "systems", "international", "health", "healthcare", "careers", "career", "jobs", "bank", "financial", "insurance", "energy", "trading", "software", "robotics", "aerospace", "space", "labs", "lab", "partners", "solutions", "global", "america", "american", "national", "university", "securities", "industries", "digital", "data", "tech", "medical", "network", "products", "brands"]);
  const words = slugify(name).split(" ").filter((w) => w.length >= 3 && !GENERIC.has(w));
  const base = domain ? domain.split(".")[0] : null;
  return words.some((w) => hay.includes(w)) || (base && base.length >= 3 && hay.includes(base)) || hay.includes(slugify(name).replace(/ /g, ""));
}
const okJsonText = async (res) => { if (!res || !res.ok) return null; try { return await res.json(); } catch { return null; } };

/** Probe the JSON APIs with slug guesses. Returns {ats, slug, count} or null. */
async function probe(name, domain) {
  for (const slug of candidates(name, domain)) {
    let r;
    // Every check requires at least one posting: SmartRecruiters (and some others) answer 200 with an empty list for ANY slug.
    r = await get(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
    if (await okJson(r, (j) => Array.isArray(j.jobs) && j.jobs.length > 0)) {
      const meta = await okJsonText(await get(`https://boards-api.greenhouse.io/v1/boards/${slug}`));
      if (meta?.name && resembles(name, domain, meta.name, slug)) return { ats: "greenhouse", slug, careersUrl: `https://job-boards.greenhouse.io/${slug}` };
    }
    const strong = slug.length >= 6 || slugify(name).split(" ").length === 1 || slug === (domain ?? "").split(".")[0];
    r = await get(`https://api.lever.co/v0/postings/${slug}?mode=json&limit=1`);
    if (!strong) { /* a 3-5 letter fragment of a multi-word name is a coin flip; skip the nameless APIs */ } else {
    if (await okJson(r, (j) => Array.isArray(j) && j.length > 0)) return { ats: "lever", slug, careersUrl: `https://jobs.lever.co/${slug}` };
    r = await get(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
    if (await okJson(r, (j) => Array.isArray(j.jobs) && j.jobs.length > 0)) return { ats: "ashby", slug, careersUrl: `https://jobs.ashbyhq.com/${slug}` };
    r = await get(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=1`);
    if (await okJson(r, (j) => j.totalFound > 0 && Array.isArray(j.content) && j.content.length > 0 && resembles(name, domain, j.content[0]?.company?.name ?? "", j.content[0]?.company?.identifier ?? ""))) return { ats: "smartrecruiters", slug, careersUrl: `https://jobs.smartrecruiters.com/${slug}` };
    r = await get(`https://apply.workable.com/api/v3/accounts/${slug}/jobs`, { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    if (await okJson(r, (j) => Array.isArray(j.results) && j.results.length > 0)) return { ats: "workable", slug, careersUrl: `https://apply.workable.com/${slug}` };
    }
  }
  for (const pre of ["careers-", "careersus-", "jobs-", ""]) for (const slug of candidates(name, domain).slice(0, 3)) {
    const host = `${pre}${slug}.icims.com`;
    const r = await get(`https://${host}/jobs/search?ss=1&in_iframe=1`, {}, 8000);
    if (r && r.ok && /\/jobs\/\d+\//.test(await r.text())) return { ats: "icims", slug: `${pre}${slug}`, careersUrl: `https://${host}` };
  }
  return null;
}

const ATS_LINK = /https?:\/\/([a-z0-9-]+)\.wd(\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_-]+)|https?:\/\/(?:job-boards|boards)\.greenhouse\.io\/(?:embed\/job_(?:board|app)(?:\/js)?\?(?:[^"'&\s]*&)?for=|)([A-Za-z0-9_-]+)|https?:\/\/jobs\.lever\.co\/([A-Za-z0-9_-]+)|https?:\/\/jobs\.ashbyhq\.com\/([A-Za-z0-9_%-]+)|https?:\/\/jobs\.smartrecruiters\.com\/([A-Za-z0-9_-]+)|https?:\/\/([a-z0-9-]+)\.icims\.com|https?:\/\/apply\.workable\.com\/([A-Za-z0-9_-]+)|https?:\/\/jobs\.jobvite\.com\/([A-Za-z0-9_-]+)|https?:\/\/([a-z0-9.-]+\.oraclecloud\.com)\/hcmUI\/CandidateExperience\/[a-z]{2}\/sites\/([A-Za-z0-9_]+)/g;

function fromLinks(html, ctx) {
  const hits = [];
  for (const m of html.matchAll(ATS_LINK)) {
    if (m[1]) { if (resembles(ctx.name, ctx.domain, m[1], m[3])) hits.push({ ats: "workday", tenant: m[1], wdn: Number(m[2]), slug: /^(job|jobs|login|wday)$/i.test(m[3]) ? null : m[3], careersUrl: `https://${m[1]}.wd${m[2]}.myworkdayjobs.com/${m[3]}` }); }
    else if (m[4]) hits.push({ ats: "greenhouse", slug: m[4], careersUrl: `https://job-boards.greenhouse.io/${m[4]}` });
    else if (m[5]) hits.push({ ats: "lever", slug: m[5], careersUrl: `https://jobs.lever.co/${m[5]}` });
    else if (m[6]) hits.push({ ats: "ashby", slug: decodeURIComponent(m[6]), careersUrl: `https://jobs.ashbyhq.com/${m[6]}` });
    else if (m[7]) hits.push({ ats: "smartrecruiters", slug: m[7], careersUrl: `https://jobs.smartrecruiters.com/${m[7]}` });
    else if (m[8] && !/^(www|media|cdn\d*)$|internal|events-|alumni-|^intern-/.test(m[8])) hits.push({ ats: "icims", slug: m[8], careersUrl: `https://${m[8]}.icims.com` });
    else if (m[9]) hits.push({ ats: "workable", slug: m[9], careersUrl: `https://apply.workable.com/${m[9]}` });
    else if (m[10]) hits.push({ ats: "jobvite", slug: m[10], careersUrl: `https://jobs.jobvite.com/${m[10]}` });
    else if (m[11]) hits.push({ ats: "oracle", slug: m[12], careersUrl: `https://${m[11]}` });
  }
  // most frequent hit wins; Workday hits without a site are kept only if nothing better exists
  const key = (h) => `${h.ats}|${h.tenant ?? ""}|${h.slug ?? ""}`;
  const counts = new Map(); for (const h of hits) counts.set(key(h), (counts.get(key(h)) ?? 0) + 1);
  const ranked = [...new Map(hits.map((h) => [key(h), h])).values()].sort((a, b) => (b.slug ? 1 : 0) - (a.slug ? 1 : 0) || counts.get(key(b)) - counts.get(key(a)));
  return ranked[0] ?? null;
}

/** Crawl the company's own pages for ATS links; follow one level of "careers"-looking links. */
async function crawl(domain, ctx) {
  const seeds = [`https://www.${domain}/careers`, `https://careers.${domain}`, `https://jobs.${domain}`, `https://www.${domain}/careers/`, `https://www.${domain}/jobs`, `https://www.${domain}`, `https://${domain}/careers`];
  const seen = new Set();
  for (const url of seeds) {
    const r = await get(url, { headers: { accept: "text/html" } }); if (!r || !r.ok) continue;
    const finalUrl = r.url ?? url; const html = await r.text();
    const direct = fromLinks(finalUrl + "\n" + html, ctx); if (direct) return direct;
    // one hop: links that look like careers/jobs pages
    const links = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => { try { return new URL(m[1], finalUrl).href; } catch { return null; } })
      .filter((u) => u && /career|job|join|work-with|opportunit/i.test(u) && !seen.has(u)).slice(0, 8);
    for (const u of links) {
      seen.add(u);
      const r2 = await get(u, { headers: { accept: "text/html" } }); if (!r2 || !r2.ok) continue;
      const hit = fromLinks((r2.url ?? u) + "\n" + await r2.text(), ctx); if (hit) return hit;
    }
  }
  return null;
}

async function resolve(c) {
  const domain = domains[c.name] ?? (c.careersUrl ? new URL(c.careersUrl).hostname.replace(/^www\./, "") : null);
  const ctx = { name: c.name, domain };
  if (domain) { const viaCrawl = await crawl(domain, ctx); if (viaCrawl) return { ...viaCrawl, how: "crawl" }; }
  const viaProbe = await probe(c.name, domain);
  if (viaProbe) return { ...viaProbe, how: "probe" };
  return null;
}

const targets = companies.filter((c) => (ALL || c.ats === "unknown" || !c.slug) && (ONLY.length === 0 || ONLY.includes(c.name)) && c.ats !== "oracle");
console.log(`resolving ${targets.length} companies (${APPLY ? "will apply to DB" : "dry run, use --apply to write the DB"})`);
const results = [];
let i = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (i < targets.length) {
    const c = targets[i++];
    const r = await resolve(c).catch(() => null);
    results.push([c, r]);
    console.log(`${(r ? r.ats : "unknown").padEnd(16)} ${c.name.padEnd(40)} ${r ? `${r.tenant ? r.tenant + "." : ""}${r.slug ?? "?"}  (${r.how})` : "-"}`);
  }
}));

// Hand corrections for names the heuristics get wrong (Flex vs FlexAI, Apex Fintech vs APEX Analytix...). null = force unknown.
const OVERRIDES = JSON.parse(readFileSync("data/ats-overrides.json", "utf8"));
for (const entry of results) { const o = OVERRIDES[entry[0].name]; if (o !== undefined) entry[1] = o ? { ...o, how: "override" } : null; }

let changed = 0;
for (const [c, r] of results) {
  if (!r) continue;
  Object.assign(c, { ats: r.ats, slug: r.slug ?? null, tenant: r.tenant ?? null, wdn: r.wdn ?? null, careersUrl: r.careersUrl ?? c.careersUrl ?? null });
  changed++;
}
writeFileSync("data/companies.json", JSON.stringify(companies, null, 2));
console.log(`\nresolved ${changed}/${targets.length}; data/companies.json updated`);

if (APPLY && changed) {
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  let n = 0, reset = 0;
  for (const [c, r] of results) {
    if (!r) {
      const { data: row } = await db.from("companies").select("id,ats,slug").eq("name", c.name).limit(1).maybeSingle();
      if (row && row.ats !== "unknown" && row.ats !== "oracle") { await db.from("companies").update({ ats: "unknown", slug: null, tenant: null, wdn: null, active: false }).eq("id", row.id); reset++; }
      continue;
    }
    const patch = { ats: r.ats, slug: r.slug ?? null, tenant: r.tenant ?? null, wdn: r.wdn ?? null, careers_url: r.careersUrl ?? null, active: true };
    const { data: row } = await db.from("companies").select("id").eq("name", c.name).limit(1).maybeSingle();
    const { error } = row ? await db.from("companies").update(patch).eq("id", row.id) : await db.from("companies").insert({ name: c.name, ...patch });
    if (error) console.error(c.name, error.message); else n++;
  }
  console.log(`DB updated: ${n} companies resolved, ${reset} reset to unknown`);
}
