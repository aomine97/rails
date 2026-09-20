// Fill companies.domain + logo_url. Domain comes from data/domains.json, else a verified guess ({slug}.com / {tenant}.com).
// Size / industry / HQ stay null until a data source is chosen (no free keyless API does this well).
// Run: node --env-file=.env.local scripts/enrich-companies.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const domains = JSON.parse(readFileSync("data/domains.json", "utf8"));
const { data: rows, error } = await db.from("companies").select("id,name,ats,slug,tenant,careers_url,domain").is("domain", null);
if (error) { console.error(error); process.exit(1); }
const alive = async (d) => { try { const r = await fetch(`https://${d}`, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(6000) }); return r.ok; } catch { return false; } };
const guessFor = (c) => {
  const base = (c.tenant ?? (["greenhouse", "lever", "ashby", "workable", "smartrecruiters", "jobvite"].includes(c.ats) ? c.slug : null) ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  return base.length >= 3 ? `${base}.com` : null;
};
let done = 0, i = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (i < rows.length) {
    const c = rows[i++];
    let domain = domains[c.name] ?? null;
    if (!domain) { const g = guessFor(c); if (g && await alive(g)) domain = g; }
    if (!domain) { console.log(`?   ${c.name}`); continue; }
    const logo_url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
    const { error: e } = await db.from("companies").update({ domain, logo_url }).eq("id", c.id);
    if (e) console.error(c.name, e.message); else { done++; console.log(`ok  ${c.name.padEnd(40)} ${domain}`); }
  }
}));
console.log(`\ndomains set for ${done}/${rows.length} companies`);
