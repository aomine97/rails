import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CanonicalProfile, skillKey } from "../schemas/profile";

/** What the model returns. Looser than CanonicalProfile; normalizeParsed() makes it canonical. */
const Parsed = z.object({
  name: z.string().catch(""),
  email: z.string().catch(""),
  phone: z.string().nullable().catch(null),
  links: z.object({ linkedin: z.string().nullable().catch(null), github: z.string().nullable().catch(null), portfolio: z.string().nullable().catch(null) }).catch({ linkedin: null, github: null, portfolio: null }),
  headline: z.string().nullable().catch(null),
  targetRoles: z.array(z.string()).catch([]),
  skills: z.array(z.object({ name: z.string(), level: z.enum(["familiar", "working", "strong"]).catch("working"), evidence: z.string().nullable().catch(null) })).catch([]),
  experience: z.array(z.object({
    title: z.string(), org: z.string().catch(""), kind: z.enum(["job", "internship", "project", "research", "volunteer", "club"]).catch("job"),
    start: z.string().nullable().catch(null), end: z.string().nullable().catch(null), bullets: z.array(z.string()).catch([]), skills: z.array(z.string()).catch([]),
  })).catch([]),
  education: z.array(z.object({
    school: z.string(), degree: z.string().catch(""), field: z.string().catch(""), gradYear: z.coerce.number().int().nullable().catch(null), startYear: z.coerce.number().int().nullable().catch(null),
    gpa: z.coerce.number().nullable().catch(null), coursework: z.array(z.string()).catch([]),
  })).catch([]),
  certifications: z.array(z.object({ name: z.string(), year: z.coerce.number().int().nullable().catch(null) })).catch([]),
  workAuthorization: z.enum(["us_citizen", "permanent_resident", "visa_needs_sponsorship", "visa_no_sponsorship", "unknown"]).catch("unknown"),
  clearance: z.enum(["none", "eligible", "public_trust", "secret", "top_secret"]).catch("none"),
  locations: z.array(z.string()).catch([]),
  address: z.object({ street: z.string().nullable().catch(null), city: z.string().nullable().catch(null), state: z.string().nullable().catch(null), zip: z.string().nullable().catch(null) }).catch({ street: null, city: null, state: null, zip: null }),
});
export type Parsed = z.infer<typeof Parsed>;

export const PARSER_SYSTEM = `You turn a resume into structured JSON. Copy facts; never invent. Rules:
- name, email, phone, links exactly as written (null if absent).
- headline: the resume's own summary line or null. targetRoles: role titles the resume is clearly aiming at (from objective, headline, or the most recent tech roles), max 5.
- skills: every technology, tool, language, framework, cert or named skill listed anywhere. evidence = the line it came from (short). level: "strong" if used in a job/internship, "working" if in a project/course, "familiar" if only listed.
- experience: every job, internship, project, research, volunteer or club entry. kind accordingly. start/end as YYYY-MM (end null if current). bullets verbatim. skills: technologies mentioned in that entry.
- education: each school. degree like "AAS", "AS", "BS", "Certificate". field as written. gradYear from "expected May 2027" style text; startYear from a "2025 - 2027" range or "since 2025" (null if absent). coursework list if present.
- address: street, city, state (2-letter), zip if the resume prints a mailing address; otherwise nulls. city/state alone are fine.
- certifications: named certs (AWS Cloud Practitioner, Security+, etc.) with year if present.
- workAuthorization / clearance: only from explicit statements ("US citizen", "Secret clearance"), else unknown / none.
- locations: cities the resume ties the person to (address, school city), max 3.
Return only JSON.`;

export async function parseResume(text: string, fallbackEmail: string, client = new Anthropic()): Promise<Parsed> {
  const res = await client.messages.create({
    model: process.env.PARSER_MODEL ?? "claude-sonnet-4-5",
    max_tokens: 6000,
    system: PARSER_SYSTEM,
    messages: [{ role: "user", content: `Resume text:\n\n${text.slice(0, 30_000)}\n\nReturn JSON with keys: name, email, phone, links{linkedin,github,portfolio}, headline, targetRoles, skills[{name,level,evidence}], experience[{title,org,kind,start,end,bullets,skills}], education[{school,degree,field,gradYear,startYear,gpa,coursework}], certifications[{name,year}], workAuthorization, clearance, locations, address{street,city,state,zip}.` }],
  });
  const raw = res.content.find((c) => c.type === "text")?.text ?? "";
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const parsed = Parsed.parse(JSON.parse(json));
  if (!parsed.email) parsed.email = fallbackEmail;
  return parsed;
}

/** Parsed (model output) -> CanonicalProfile with keys, ids and sources. Pure; tested. */
export function normalizeParsed(p: Parsed, fallbackEmail: string): CanonicalProfile {
  const seen = new Set<string>();
  const skills = p.skills.map((s) => ({ name: s.name.trim(), key: skillKey(s.name), level: s.level, evidence: s.evidence ?? undefined, source: "resume" as const }))
    .filter((s) => s.name && !seen.has(s.key) && seen.add(s.key));
  const experience = p.experience.map((e, i) => ({
    id: `e${i + 1}`, title: e.title.trim(), org: e.org.trim(), kind: e.kind, start: ym(e.start), end: ym(e.end),
    bullets: e.bullets.map((b) => b.trim()).filter(Boolean), skills: [...new Set(e.skills.map(skillKey))], source: "resume" as const,
  })).filter((e) => e.title);
  const education = p.education.map((ed) => ({ school: ed.school.trim(), degree: ed.degree.trim(), field: ed.field.trim(), gradYear: ed.gradYear, startYear: ed.startYear, gpa: ed.gpa, coursework: ed.coursework.map((c) => c.trim()).filter(Boolean), source: "resume" as const })).filter((e) => e.school);
  const certifications = p.certifications.map((c) => ({ name: c.name.trim(), key: skillKey(c.name), year: c.year, source: "resume" as const })).filter((c) => c.name);
  for (const c of certifications) if (!seen.has(c.key)) { seen.add(c.key); skills.push({ name: c.name, key: c.key, level: "working", evidence: `Certification: ${c.name}`, source: "resume" }); }
  const email = z.string().email().safeParse(p.email.trim().toLowerCase()).success ? p.email.trim().toLowerCase() : fallbackEmail;
  return CanonicalProfile.parse({
    version: 1, name: p.name.trim() || "", email, phone: p.phone?.trim() || null, preferredName: null,
    address: { street: p.address.street?.trim() || null, city: p.address.city?.trim() || null, state: p.address.state?.trim() || null, zip: p.address.zip?.trim() || null },
    links: { linkedin: p.links.linkedin, github: p.links.github, portfolio: p.links.portfolio },
    headline: p.headline?.trim() || null, targetRoles: p.targetRoles.map((r) => r.trim()).filter(Boolean).slice(0, 5),
    skills, experience, education, certifications,
    constraints: { workAuthorization: p.workAuthorization, clearance: p.clearance, locations: p.locations.slice(0, 3), maxCommuteMiles: 30, remoteOk: true, employmentTypes: defaultTypes(experience), earliestStart: null, minPayHourly: null },
  });
}

/** Students default to internship/new grad/entry; 3+ years of jobs adds mid; 7+ adds senior. */
function defaultTypes(exp: { kind: string; start: string | null; end: string | null }[]): CanonicalProfile["constraints"]["employmentTypes"] {
  const now = new Date();
  const months = exp.filter((e) => e.kind === "job").reduce((a, e) => {
    if (!e.start) return a; const [sy, sm] = e.start.split("-").map(Number); const [ey, em] = e.end ? e.end.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
    return a + Math.max(0, (ey - sy) * 12 + (em - sm));
  }, 0);
  if (months >= 84) return ["mid", "senior"]; if (months >= 36) return ["entry", "mid"]; return ["internship", "new_grad", "entry"];
}

/** "May 2027" / "2025-08" / "08/2025" / "Present" -> "YYYY-MM" or null */
export function ym(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (/present|current|now/.test(s)) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{4})/); if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  m = s.match(/([a-z]{3})[a-z]*\.?\s+(\d{4})/); if (m && months.includes(m[1])) return `${m[2]}-${String(months.indexOf(m[1]) + 1).padStart(2, "0")}`;
  m = s.match(/(\d{4})/); if (m) return `${m[1]}-01`;
  return null;
}
