import type { AtsKind } from "../ats/types";

/** URL -> ATS + slug. Mirrors scripts/seed-companies.mjs detectAts, typed for app code. */
export function detectAts(url: string): { ats: AtsKind; slug: string | null; tenant?: string; wdn?: number } {
  let u: URL; try { u = new URL(url); } catch { return { ats: "unknown", slug: null }; }
  const h = u.hostname.toLowerCase(); const p = u.pathname.split("/").filter(Boolean);
  if (/^(job-boards|boards|job-boards\.eu)\.greenhouse\.io$/.test(h)) return { ats: "greenhouse", slug: p[0] ?? null };
  if (u.searchParams.has("gh_jid") || h.endsWith("greenhouse.io")) return { ats: "greenhouse", slug: null };
  if (h === "jobs.lever.co") return { ats: "lever", slug: p[0] ?? null };
  if (h === "jobs.ashbyhq.com") return { ats: "ashby", slug: p[0] ?? null };
  if (h === "jobs.smartrecruiters.com") return { ats: "smartrecruiters", slug: p[0] ?? null };
  const wd = h.match(/^([a-z0-9-]+)\.wd(\d+)\.myworkdayjobs\.com$/);
  if (wd) { const locale = /^[a-z]{2}-[A-Z]{2}$/.test(p[0] ?? "") ? p.shift() : null; void locale; return { ats: "workday", slug: p[0] ?? null, tenant: wd[1], wdn: Number(wd[2]) }; }
  if (h.endsWith(".icims.com")) return { ats: "icims", slug: h.split(".")[0] };
  if (h.includes("oraclecloud.com")) return { ats: "oracle", slug: null };
  if (h.endsWith(".workable.com") || h === "apply.workable.com") return { ats: "workable", slug: p[0] ?? null };
  if (h === "jobs.jobvite.com") return { ats: "jobvite", slug: p[0] ?? null };
  if (h.endsWith(".taleo.net")) return { ats: "taleo", slug: null };
  return { ats: "unknown", slug: null };
}
