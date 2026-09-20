import type { CanonicalProfile } from "../schemas/profile";
import type { JobTags } from "../jobs/tags";
import type { Score } from "./score";

/** One plain sentence per sub-score, for the "why this score" panel. */
export function explainScore(p: CanonicalProfile, t: JobTags, s: Score): { experience: string; skills: string; field: string; overall: string } {
  const req = t.requiredSkills.length, pref = t.preferredSkills.length;
  const reqHit = s.matchedSkills.filter((k) => t.requiredSkills.includes(k)).length;
  const prefHit = s.matchedSkills.length - reqHit;
  const skills = req + pref === 0 ? "The posting doesn't name specific skills, so this is neutral."
    : `You match ${reqHit} of ${req} required${pref ? ` and ${prefHit} of ${pref} preferred` : ""} skills.${s.missingRequired.length ? ` Missing: ${s.missingRequired.slice(0, 3).join(", ")}${s.missingRequired.length > 3 ? "…" : ""}.` : ""}`;
  const jobs = p.experience.filter((e) => e.kind === "job" || e.kind === "internship").length;
  const projects = p.experience.filter((e) => e.kind === "project" || e.kind === "research").length;
  const experience = t.level === "internship" || t.level === "new_grad"
    ? `${t.level === "internship" ? "An internship" : "A new-grad role"} doesn't require prior years. You have ${jobs} role${jobs === 1 ? "" : "s"} and ${projects} project${projects === 1 ? "" : "s"} on your profile${projects ? ", which helps" : "; a project would help"}.`
    : t.yearsMin ? `They ask for ${t.yearsMin}+ years. Your profile shows ${jobs} role${jobs === 1 ? "" : "s"}${s.sub.experience >= 85 ? ", which covers it." : ", which reads as light for that."}`
    : `No years requirement stated. Your ${jobs} role${jobs === 1 ? "" : "s"} and ${projects} project${projects === 1 ? "" : "s"} count.`;
  const fieldName = t.field.replace("_", " ");
  const field = s.sub.field >= 85 ? `Your target roles and skills point straight at ${fieldName}.`
    : s.sub.field >= 70 ? `This is ${fieldName}; your profile leans that way but the target roles don't say it explicitly.`
    : `This is ${fieldName}, which your profile doesn't point at yet. Adding it as a target role would move this.`;
  const overall = s.hardBlocks.length ? `Capped: ${s.hardBlocks.join("; ")}.`
    : s.band === "strong" ? "Apply. This is one of the closest matches in your feed."
    : s.band === "good" ? "Worth applying. Fix the gaps below first and the number goes up."
    : "A stretch. Apply if you want it, but the tailored resume should lean on what you do match.";
  return { experience, skills, field, overall };
}
