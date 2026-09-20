import Anthropic from "@anthropic-ai/sdk";
import { JobTags, TAGGER_SYSTEM, type JobTags as JobTagsT } from "./tags";
import { skillKey } from "../schemas/profile";

export const TAGGER_MODEL = () => process.env.TAGGER_MODEL ?? "claude-haiku-4-5";

export type TagInput = { title: string; company: string; location: string | null; descriptionText: string };

/** The exact request the online path and the nightly batch path both send. */
export function tagRequest(input: TagInput): Anthropic.MessageCreateParamsNonStreaming {
  const text = input.descriptionText.slice(0, 12_000);
  return {
    model: TAGGER_MODEL(),
    max_tokens: 2500,
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
  tags.requiredSkills = [...new Set(tags.requiredSkills.map(skillKey))];
  tags.preferredSkills = [...new Set(tags.preferredSkills.map(skillKey))].filter((k) => !tags.requiredSkills.includes(k));
  return tags;
}

/** Tag one posting with a cheap model. Returns validated tags or throws. ~1-2k tokens in, ~400 out. */
export async function tagJob(input: TagInput, client = new Anthropic()) {
  const res = await client.messages.create(tagRequest(input));
  return parseTagText(res.content.find((c) => c.type === "text")?.text ?? "");
}
