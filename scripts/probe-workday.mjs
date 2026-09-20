// Why do some Workday tenants stop at exactly 40? Prints total + rows per page for one tenant.
// Run: node scripts/probe-workday.mjs <tenant> <wdn> <site>   e.g. node scripts/probe-workday.mjs nxp 3 careers
const [tenant, wdn, site] = process.argv.slice(2);
if (!site) { console.error("usage: node scripts/probe-workday.mjs <tenant> <wdn> <site>"); process.exit(1); }
const base = `https://${tenant}.wd${wdn}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;
for (const limit of [20]) for (let offset = 0; offset <= 120; offset += limit) {
  const res = await fetch(base, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", "user-agent": "RailsJobs/0.1" }, body: JSON.stringify({ appliedFacets: {}, limit, offset, searchText: "" }) });
  const text = await res.text();
  let j = null; try { j = JSON.parse(text); } catch { /* not json */ }
  console.log(`offset ${String(offset).padStart(3)} limit ${limit}: HTTP ${res.status}  total=${j?.total ?? "?"}  rows=${j?.jobPostings?.length ?? "?"}  ${j ? "" : text.slice(0, 120).replace(/\s+/g, " ")}`);
  if (!j?.jobPostings?.length) break;
}
