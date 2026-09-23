import Anthropic from "@anthropic-ai/sdk";
import { JobTags, TAGGER_SYSTEM, type JobTags as JobTagsT } from "./tags";
import { skillKey } from "../schemas/profile";
import { recordUsage } from "../ai/usage";

export const TAGGER_MODEL = () => process.env.TAGGER_MODEL ?? "claude-haiku-4-5";

export type TagInput = { title: string; company: string; location: string | null; descriptionText: string };

/** Paragraphs that say nothing about the job: EEO and accommodation notices, benefits lists, "about us", privacy and
 *  fraud warnings. A third or more of a typical posting. Any paragraph with a dollar figure stays, because pay is tagged. */
const BOILERPLATE = /equal (employment )?opportunity|\beeo\b|affirmative action|regardless of (race|color|religion)|without regard to|protected (veteran|characteristic|class)|reasonable accommodation|e-verify|pay transparency|drug[- ]free|background check|benefits (include|package|overview)|we offer|our benefits|401\(?k\)?|paid time off|\bpto\b|health, dental|medical, dental|parental leave|tuition reimbursement|employee assistance|about (us|the company|the team)|who we are|our (mission|story|values|culture)|privacy (notice|policy)|recruit(ment|ing) fraud|scam|cookie|by applying|applicant privacy|know your rights|ccpa|gdpr/i;
export function trimDescription(text: string, max = 7000): string {
  const paras = text.split(/\n{2,}|\n(?=[A-Z][^\n]{0,60}:?\n)/).map((p) => p.trim()).filter(Boolean);
  const kept = paras.filter((p) => /\$\s?\d/.test(p) || !BOILERPLATE.test(p));
  const out = (kept.length ? kept : paras).join("\n\n");
  return out.length > max ? out.slice(0, max) : out;
}

/** The exact request the online path and the nightly batch path both send. */
export function tagRequest(input: TagInput): Anthropic.MessageCreateParamsNonStreaming {
  const text = trimDescription(input.descriptionText);
  return {
    model: TAGGER_MODEL(),
    max_tokens: 1500,
    system: TAGGER_SYSTEM,
    messages: [{ role: "user", content: `Title: ${input.title}\nCompany: ${input.company}\nLocation: ${input.location ?? "n/a"}\n\n${text}\n\nReturn JSON with keys: ${Object.keys(JobTags.shape).join(", ")}.` }],
  };
}

/** Model text -> validated, normalized tags. Throws on unparseable output. */
export function parseTagText(raw: string): JobTagsT {
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const parsed = JSON.parse(json) as Record<string, unknown>;
  for (const k of ["requiredSkills", "preferredSkills"]) if (Array.isArray(parsed[k])) parsed[k] = (parsed[k] as unknown[]).map((x) => typeof x === "string" ? x : String((x as { name?: string })?.name ?? "")).filter(Boolean);
  for (const k of ["sponsorship", "remote", "level", "field", "minDegree", "clearanceRequired", "employmentType"]) if (typeof parsed[k] === "string") parsed[k] = (parsed[k] as string).toLowerCase().replace(/[\s-]+/g, "_");
  const tags = JobTags.parse(parsed);
  tags.requirements = tags.requirements.slice(0, 12);
  tags.requiredSkills = [...new Set(tags.requiredSkills.map(skillKey))];
  tags.preferredSkills = [...new Set(tags.preferredSkills.map(skillKey))].filter((k) => !tags.requiredSkills.includes(k));
  return tags;
}

/** Tag one posting with a cheap model at full price. The pipeline only uses this for jobs under two hours old;
 *  everything else goes through the half-price batch. Returns validated tags or throws. */
export async function tagJob(input: TagInput, client = new Anthropic()) {
  const req = tagRequest(input);
  const res = await client.messages.create(req);
  recordUsage("tag", req.model, res.usage);
  return parseTagText(res.content.find((c) => c.type === "text")?.text ?? "");
}
