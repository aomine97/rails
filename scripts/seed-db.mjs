// Loads data/companies.json into the companies table. Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
// Run: node --env-file=.env.local scripts/seed-db.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const companies = JSON.parse(readFileSync("data/companies.json", "utf8"));
const rows = companies.map((c) => ({ name: c.name, ats: c.ats, slug: c.slug, tenant: c.tenant ?? null, wdn: c.wdn ?? null, careers_url: c.careersUrl ?? null }));
for (let i = 0; i < rows.length; i += 200) {
  const { error } = await db.from("companies").upsert(rows.slice(i, i + 200), { onConflict: "ats,slug,tenant", ignoreDuplicates: true });
  if (error) { console.error(error); process.exit(1); }
}
console.log(`seeded ${rows.length} companies`);
