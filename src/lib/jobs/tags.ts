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

Return exactly this shape (values are examples):
{"level":"internship","field":"software","requiredSkills":["python","sql"],"preferredSkills":["aws"],
 "requirements":[{"text":"Currently pursuing a degree in Computer Science","required":true},{"text":"Experience with AWS","required":false}],
 "minDegree":"bachelor","yearsMin":0,"clearanceRequired":"none","usCitizenRequired":null,"sponsorship":"unknown",
 "remote":"hybrid","employmentType":"internship","payMinHourly":40,"payMaxHourly":48,"hasOnlineAssessment":true}`;
