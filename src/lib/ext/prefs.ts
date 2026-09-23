import { z } from "zod";
import type { FillFields } from "./fields";

/** Autofill settings (screen 15). Stored on profiles.autofill_prefs; read by /api/ext/me, /api/ext/answers, /api/ext/resume.
 *  EEO, saved answers and ATS passwords are NOT here: those stay in the extension's storage on the user's device. */
export const AutofillPrefs = z.object({
  payText: z.string().trim().max(60).nullable().catch(null).default(null),
  relocate: z.enum(["auto", "yes", "no"]).catch("auto").default("auto"),
  hoursPerWeek: z.string().trim().max(40).nullable().catch(null).default(null),
  essays: z.enum(["draft", "skip"]).catch("draft").default("draft"),
  coverLetter: z.enum(["when_asked", "never"]).catch("when_asked").default("when_asked"),
  resume: z.enum(["tailored", "base"]).catch("tailored").default("tailored"),
});
export type AutofillPrefs = z.infer<typeof AutofillPrefs>;

export function readPrefs(raw: unknown): AutofillPrefs {
  return AutofillPrefs.parse(raw && typeof raw === "object" ? raw : {});
}

/** The user's explicit answers win over what Rails inferred from the profile. */
export function applyPrefs(f: FillFields, p: AutofillPrefs): FillFields {
  return {
    ...f,
    desiredPay: p.payText || f.desiredPay,
    willRelocate: p.relocate === "yes" ? true : p.relocate === "no" ? false : f.willRelocate,
  };
}

/** Long free-text questions ("Why do you want to work here?", "Describe a time…") when the user writes those themselves. */
export const ESSAY = /\bwhy\b|describe|tell us|explain|what (interests|excites|motivates)|cover letter|in your own words|share (a|an)|walk us through/i;
export function isEssay(q: { label: string; kind: string }): boolean {
  return q.kind === "textarea" || (q.kind === "text" && ESSAY.test(q.label) && q.label.length > 40);
}
