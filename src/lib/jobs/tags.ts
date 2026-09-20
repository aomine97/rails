import { z } from "zod";

/** What the tagger extracts from a posting. Cheap LLM, Zod-validated, cached per job. */
export const JobTags = z.object({
  level: z.enum(["internship", "new_grad", "entry", "mid", "senior", "unknown"]).catch("unknown"),
  /** STEM + nursing. "other" is everything else and never reaches a feed. */
  field: z.enum(["software", "data", "cloud", "it_support", "cyber", "product", "electrical", "mechanical", "civil", "chemical", "biotech", "science", "math", "nursing", "healthcare", "other"]).catch("other"),
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
- field: the closest of software, data, cloud, it_support, cyber, product, electrical (EE/electronics/embedded/hardware), mechanical (ME/manufacturing/robotics/aerospace), civil (civil/structural/environmental/construction engineering), chemical (chemical/materials/process engineering), biotech (biology/biomedical/pharma lab/bioinformatics), science (physics/chemistry/geology/research scientist), math (statistics/actuarial/quant/operations research), nursing (RN/LPN/nursing students/CNA), healthcare (allied health: lab tech, radiology, pharmacy tech, PT/OT, EMT, medical assistant). Use "other" for sales, retail, hospitality, admin, finance, marketing, HR, legal, trades, drivers, education and anything not STEM or nursing.
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

/** Titles that never need a model call: clearly senior/management, or clearly not a tech role. Saves ~half the tagging bill. */
const SENIOR_RE = /\b(senior|sr\.?|staff|principal|distinguished|director|vp|vice president|head of|chief|manager|managing|lead|architect|fellow|partner)\b/i;
const NON_STEM_RE = /\b(janitor|custodi|cashier|barista|cook|chef|server|bartend|driver|cdl|warehouse|forklift|welder|electrician|plumber|hvac|mechanic|sales associate|retail|store manager|merchandis|marketing manager|account executive|recruiter|hr business|payroll|paralegal|attorney|counsel|loan officer|teller|real estate|property manager|teacher|instructor|professor|lecturer|coach|security guard|patrol|pilot|flight attendant|housekeep|laundry|landscap|groundskeep|maintenance worker|machinist|assembler|production operator|line cook|dishwasher|social worker|chaplain|groomer|receptionist|front desk|customer service|call center|collections|bookkeep|accountant|auditor|tax\b|copywriter|content writer|graphic designer|brand|public relations|event|talent acquisition)\b/i;
/** Titles that are STEM or nursing even when a non-STEM word appears ("Sales Engineer", "Clinical Nurse", "Lab Technician"). */
const STEM_RE = /\b(software|engineer|engineering|developer|programmer|data|cloud|it\b|cyber|security analyst|network|devops|analyst|qa\b|technolog|scientist|science|research|laborator|lab\b|biolog|chemist|chemical|physic|mathemat|statistic|actuar|quant|nurse|nursing|rn\b|lpn\b|cna\b|clinical|radiolog|pharmac|therapist|paramedic|emt\b|medical assistant|phlebotom|sonograph|surgical tech|respiratory)\b/i;

export function pretag(title: string): JobTags | null {
  if (SENIOR_RE.test(title) && !/\b(intern|internship|co-op|junior|associate|entry)\b/i.test(title))
    return { ...EMPTY_TAGS, level: "senior", field: "other", summary: "" };
  if (NON_STEM_RE.test(title) && !STEM_RE.test(title))
    return { ...EMPTY_TAGS, level: "unknown", field: "other", summary: "" };
  return null;
}

export const EMPTY_TAGS: JobTags = { level: "unknown", field: "other", requiredSkills: [], preferredSkills: [], requirements: [], minDegree: "unknown", yearsMin: null, clearanceRequired: "unknown", usCitizenRequired: null, sponsorship: "unknown", remote: "unknown", employmentType: "unknown", payMinHourly: null, payMaxHourly: null, hasOnlineAssessment: null, summary: "", relocationOffered: null, country: "unknown" };
