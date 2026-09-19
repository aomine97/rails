import { z } from "zod";

/**
 * Canonical profile: the single source of truth for scoring, tailoring, autofill.
 * Every value here either came from the user's resume (source: "resume") or was typed by the user (source: "user").
 * Tailored resume lines must trace back to one of these entries. No third source exists.
 */
export const Source = z.enum(["resume", "user"]);

export const Skill = z.object({
  name: z.string().min(1),
  /** normalized lowercase key for matching, e.g. "python", "aws", "sql" */
  key: z.string().min(1),
  level: z.enum(["familiar", "working", "strong"]).default("working"),
  evidence: z.string().optional(), // the resume line or the user's own words
  source: Source,
});

export const Experience = z.object({
  id: z.string(),
  title: z.string(),
  org: z.string(),
  kind: z.enum(["job", "internship", "project", "research", "volunteer", "club"]),
  start: z.string().nullable(), // YYYY-MM
  end: z.string().nullable(),   // YYYY-MM or null = current
  bullets: z.array(z.string()),
  skills: z.array(z.string()).default([]), // skill keys
  source: Source,
});

export const Education = z.object({
  school: z.string(),
  degree: z.string(),            // "AAS", "AS", "BS", "Certificate"
  field: z.string(),             // "Information Systems Technology, Cloud Computing"
  gradYear: z.number().int().nullable(),
  gpa: z.number().nullable(),
  coursework: z.array(z.string()).default([]),
  source: Source,
});

export const Certification = z.object({
  name: z.string(), key: z.string(), year: z.number().int().nullable(), source: Source,
});

export const Constraints = z.object({
  workAuthorization: z.enum(["us_citizen", "permanent_resident", "visa_needs_sponsorship", "visa_no_sponsorship", "unknown"]).default("unknown"),
  clearance: z.enum(["none", "eligible", "public_trust", "secret", "top_secret"]).default("none"),
  locations: z.array(z.string()).default([]), // "McLean, VA", "Remote"
  maxCommuteMiles: z.number().nullable().default(null),
  remoteOk: z.boolean().default(true),
  employmentTypes: z.array(z.enum(["internship", "new_grad", "entry", "part_time", "contract"])).default(["internship", "new_grad", "entry"]),
  earliestStart: z.string().nullable().default(null),
  minPayHourly: z.number().nullable().default(null),
});

export const CanonicalProfile = z.object({
  version: z.literal(1),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  links: z.object({ linkedin: z.string().nullable(), github: z.string().nullable(), portfolio: z.string().nullable() }),
  headline: z.string().nullable(),
  targetRoles: z.array(z.string()).default([]), // "Software Engineer Intern", "Cloud Support"
  skills: z.array(Skill),
  experience: z.array(Experience),
  education: z.array(Education),
  certifications: z.array(Certification).default([]),
  constraints: Constraints,
});
export type CanonicalProfile = z.infer<typeof CanonicalProfile>;
export type Skill = z.infer<typeof Skill>;

/** Lowercase, strip punctuation, collapse aliases so "Node.js" and "nodejs" match. */
export function skillKey(name: string): string {
  const k = name.toLowerCase().replace(/[^a-z0-9+#.\- ]/g, " ").replace(/\s+/g, " ").trim();
  return SKILL_ALIASES[k] ?? k.replace(/\.js$/, "js").replace(/[\s.]/g, "");
}

const SKILL_ALIASES: Record<string, string> = {
  "node": "nodejs", "node.js": "nodejs", "nodejs": "nodejs",
  "amazon web services": "aws", "aws": "aws", "aws cloud practitioner": "aws-ccp", "cloud practitioner": "aws-ccp", "aws ccp": "aws-ccp", "aws-ccp": "aws-ccp",
  "security+": "security+", "comptia security+": "security+", "sec+": "security+",
  "postgres": "postgresql", "postgresql": "postgresql", "ms sql": "sqlserver", "sql server": "sqlserver",
  "react.js": "react", "reactjs": "react", "react": "react",
  "c++": "c++", "cpp": "c++", "c#": "c#", "csharp": "c#",
  "javascript": "javascript", "js": "javascript", "typescript": "typescript", "ts": "typescript",
  "golang": "go", "go": "go", "k8s": "kubernetes", "kubernetes": "kubernetes",
  "ci/cd": "cicd", "ci cd": "cicd", "github actions": "github-actions",
  "power bi": "powerbi", "powerbi": "powerbi", "tableau": "tableau", "excel": "excel",
  "rest apis": "rest", "rest api": "rest", "restful apis": "rest",
};
