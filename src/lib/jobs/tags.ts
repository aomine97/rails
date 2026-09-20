import { z } from "zod";

/** What the tagger extracts from a posting. Cheap LLM, Zod-validated, cached per job. */
export const JobTags = z.object({
  level: z.enum(["internship", "new_grad", "entry", "mid", "senior", "unknown"]).catch("unknown"),
  field: z.enum(["software", "data", "cloud", "it_support", "cyber", "product", "other"]).catch("other"),
  requiredSkills: z.array(z.string()).max(30).catch([]),   // keys via skillKey()
  preferredSkills: z.array(z.string()).max(30).catch([]),
  // verbatim lines for the ✓/!/✗ view. Models sometimes return plain strings; coerce them.
  requirements: z.preprocess(
    (v) => (Array.isArray(v) ? v.slice(0, 40).map((r) => (typeof r === "string" ? { text: r, required: !/preferred|nice to have|bonus|plus\b/i.test(r) } : r)) : []),
    z.array(z.object({ text: z.string(), required: z.boolean().default(true) })).max(40).catch([]),
  ),
  minDegree: z.enum(["none", "associate", "bachelor", "master", "phd", "unknown"]).catch("unknown"),
  yearsMin: z.coerce.number().int().min(0).nullable().catch(null),
  clearanceRequired: z.enum(["none", "eligible", "public_trust", "secret", "top_secret", "unknown"]).catch("unknown"),
  usCitizenRequired: z.boolean().nullable().catch(null),
  sponsorship: z.enum(["yes", "no", "unknown"]).catch("unknown"),
  remote: z.enum(["remote", "hybrid", "onsite", "unknown"]).catch("unknown"),
  employmentType: z.enum(["full_time", "part_time", "internship", "contract", "unknown"]).catch("unknown"),
  payMinHourly: z.coerce.number().nullable().catch(null),
  payMaxHourly: z.coerce.number().nullable().catch(null),
  hasOnlineAssessment: z.boolean().nullable().catch(null),
  /** two plain sentences: what the job is and what they want. Shown on the card. */
  summary: z.string().max(400).catch(""),
  relocationOffered: z.boolean().nullable().catch(null),
  /** ISO-2 country of the primary location, "REMOTE" when fully remote, "unknown" otherwise */
  country: z.string().max(8).catch("unknown"),
});
export type JobTags = z.infer<typeof JobTags>;

export const TAGGER_SYSTEM = `You extract structured facts from a job posting. Output only JSON matching the schema. Rules:
- requirements: copy each qualification line verbatim (max 40), required=true for "required/must/minimum", false for "preferred/nice to have/bonus".
- requiredSkills/preferredSkills: short lowercase technology or skill names ("python", "aws", "sql", "react", "security+"). No sentences.
- level: internship if the title or text says intern/co-op; new_grad if "new grad"/"university"/"early career" with 0-1 years; entry for 0-2 years; else mid/senior.
- field: the closest of software, data, cloud, it_support, cyber, product, other.
- clearanceRequired / usCitizenRequired: only from explicit text. Unknown otherwise.
- Convert annual pay to hourly by dividing by 2080. Null when absent.
- hasOnlineAssessment: true only if the text mentions HackerRank, CodeSignal, coding assessment, or similar.
- summary: two plain sentences a student can read in 5 seconds: what you'd actually do, and the one or two things they care most about. No marketing language.
- relocationOffered: true only if relocation assistance is explicitly offered.
- country: ISO-2 code of the primary work location (US, CA, GB, IN...), "REMOTE" if fully remote with no country, "unknown" if unclear.

Return exactly this shape (values are examples):
{"level":"internship","field":"software","requiredSkills":["python","sql"],"preferredSkills":["aws"],
 "requirements":[{"text":"Currently pursuing a degree in Computer Science","required":true},{"text":"Experience with AWS","required":false}],
 "minDegree":"bachelor","yearsMin":0,"clearanceRequired":"none","usCitizenRequired":null,"sponsorship":"unknown",
 "remote":"hybrid","employmentType":"internship","payMinHourly":40,"payMaxHourly":48,"hasOnlineAssessment":true,
 "summary":"Build internal tools on a small platform team, mostly Python services and a React admin. They want someone who has shipped a project end to end and can talk about it.","relocationOffered":false,"country":"US"}`;
