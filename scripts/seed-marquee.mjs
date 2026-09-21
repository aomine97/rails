// Marquee employers (data/marquee.json): verify each ATS guess against the live public API, then upsert with tier=1.
// Nothing is written for a guess that does not answer with real postings. "custom" entries get tier=1 with ats=unknown so the
// name ranks first when a feed appears later (own-site adapters are a separate item).
// Run: node --env-file=.env.local scripts/seed-marquee.mjs [--dry]
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry");
const UA = "RailsJobs/0.1 (+https://rails-psi.vercel.app)";
const list = JSON.parse(readFileSync("data/marquee.json", "utf8")).companies;
const db = DRY ? null : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function get(url, init = {}) {
  try { return await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(12_000), ...init, headers: { "user-agent": UA, accept: "application/json", ...(init.headers ?? {}) } }); } catch { return null; }
}
const json = async (r) => { if (!r || !r.ok) return null; try { return await r.json(); } catch { return null; } };

/** -> { ok, count, careersUrl } */
async function verify(c) {
  switch (c.ats) {
    case "greenhouse": { const j = await json(await get(`https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs`)); return { ok: (j?.jobs?.length ?? 0) > 0, count: j?.jobs?.length ?? 0, careersUrl: `https://job-boards.greenhouse.io/${c.slug}` }; }
    case "lever": { const j = await json(await get(`https://api.lever.co/v0/postings/${c.slug}?mode=json&limit=5`)); return { ok: Array.isArray(j) && j.length > 0, count: Array.isArray(j) ? j.length : 0, careersUrl: `https://jobs.lever.co/${c.slug}` }; }
    case "ashby": { const j = await json(await get(`https://api.ashbyhq.com/posting-api/job-board/${c.slug}`)); return { ok: (j?.jobs?.length ?? 0) > 0, count: j?.jobs?.length ?? 0, careersUrl: `https://jobs.ashbyhq.com/${c.slug}` }; }
    case "workday": {
      const j = await json(await get(`https://${c.tenant}.wd${c.wdn}.myworkdayjobs.com/wday/cxs/${c.tenant}/${c.slug}/jobs`, { method: "POST", body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: "" }), headers: { "content-type": "application/json" } }));
      return { ok: (j?.total ?? 0) > 0, count: j?.total ?? 0, careersUrl: `https://${c.tenant}.wd${c.wdn}.myworkdayjobs.com/${c.slug}` };
    }
    case "icims": { const r = await get(`https://${c.slug}.icims.com/jobs/search?ss=1&in_iframe=1`, { headers: { accept: "text/html" } }); const t = r && r.ok ? await r.text() : ""; return { ok: /\/jobs\/\d+\//.test(t), count: (t.match(/\/jobs\/\d+\//g) ?? []).length, careersUrl: `https://${c.slug}.icims.com` }; }
    case "oracle": return { ok: !!c.careersUrl, count: null, careersUrl: c.careersUrl ?? null, keep: true };
    case "usajobs": return { ok: true, count: null, careersUrl: "https://www.usajobs.gov", keep: true };
    default: return { ok: false, count: 0, careersUrl: null, custom: true };
  }
}

const out = []; let verified = 0, custom = 0, failed = 0, wrote = 0;
for (const c of list) {
  const v = await verify(c);
  const line = { name: c.name, ats: c.ats, slug: c.slug ?? null, ok: v.ok, count: v.count };
  out.push(line);
  console.log(`${v.ok ? "OK  " : v.custom ? "CUST" : "FAIL"} ${c.name.padEnd(26)} ${c.ats.padEnd(13)} ${(c.slug ?? c.tenant ?? "").padEnd(32)} ${v.count ?? ""}`);
  if (v.custom) custom++; else if (v.ok) verified++; else failed++;
  if (DRY) continue;
  // find by name (case-insensitive) or by ats+slug
  const { data: byName } = await db.from("companies").select("id,ats,slug,tier").ilike("name", c.name).limit(1).maybeSingle();
  const { data: bySlug } = c.slug ? await db.from("companies").select("id,ats,slug,tier").eq("ats", c.ats).eq("slug", c.slug).limit(1).maybeSingle() : { data: null };
  const row = byName ?? bySlug;
  const patch = { tier: 1, domain: c.domain ?? null, active: true };
  if (v.ok && !v.custom) Object.assign(patch, { ats: c.ats, slug: c.slug ?? null, tenant: c.tenant ?? null, wdn: c.wdn ?? null, careers_url: v.careersUrl });
  else if (!row) Object.assign(patch, { ats: "unknown", careers_url: c.careersUrl ?? (c.domain ? `https://www.${c.domain}/careers` : null) });
  const { error } = row ? await db.from("companies").update(patch).eq("id", row.id) : await db.from("companies").insert({ name: c.name, ...patch });
  if (error) console.log(`   db: ${error.message}`); else wrote++;
}
writeFileSync("data/marquee-verified.json", JSON.stringify(out, null, 2));
console.log(`\nverified ${verified} · custom-site ${custom} · failed ${failed} · rows written ${wrote}${DRY ? " (dry run)" : ""}`);
console.log("FAIL rows: fix the slug in data/marquee.json (open the company's careers page, copy the ATS URL) and rerun.");
