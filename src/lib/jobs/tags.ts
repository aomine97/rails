import { z } from "zod";

/** What the tagger extracts from a posting. Cheap LLM, Zod-validated, cached per job. */
export const JobTags = z.object({
  level: z.enum(["internship", "new_grad", "entry", "mid", "senior", "unknown"]),
  field: z.enum(["software", "data", "cloud", "it_support", "cyber", "product", "other"]),
  requiredSkills: z.array(z.string()).max(30),   // keys via skillKey()
  preferredSkills: z.array(z.string()).max(30),
  requirements: z.array(z.object({ text: z.string(), required: z.boolean() })).max(40), // verbatim lines for the ✓/!/✗ view
  minDegree: z.enum(["none", "associate", "bachelor", "master", "phd", "unknown"]),
  yearsMin: z.number().int().min(0).nullable(),
  clearanceRequired: z.enum(["none", "eligible", "public_trust", "secret", "top_secret", "unknown"]),
  usCitizenRequired: z.boolean().nullable(),
  sponsorship: z.enum(["yes", "no", "unknown"]),
  remote: z.enum(["remote", "hybrid", "onsite", "unknown"]),
  employmentType: z.enum(["full_time", "part_time", "internship", "contract", "unknown"]),
  payMinHourly: z.number().nullable(),
  payMaxHourly: z.number().nullable(),
  hasOnlineAssessment: z.boolean().nullable(),
});
export type JobTags = z.infer<typeof JobTags>;

export const TAGGER_SYSTEM = `You extract structured facts from a job posting. Output only JSON matching the schema. Rules:
- requirements: copy each qualification line verbatim (max 40), required=true for "required/must/minimum", false for "preferred/nice to have/bonus".
- requiredSkills/preferredSkills: short lowercase technology or skill names ("python", "aws", "sql", "react", "security+"). No sentences.
- level: internship if the title or text says intern/co-op; new_grad if "new grad"/"university"/"early career" with 0-1 years; entry for 0-2 years; else mid/senior.
- field: the closest of software, data, cloud, it_support, cyber, product, other.
- clearanceRequired / usCitizenRequired: only from explicit text. Unknown otherwise.
- Convert annual pay to hourly by dividing by 2080. Null when absent.
- hasOnlineAssessment: true only if the text mentions HackerRank, CodeSignal, coding assessment, or similar.`;
