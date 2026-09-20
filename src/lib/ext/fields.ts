import type { CanonicalProfile } from "@/lib/schemas/profile";

/** The flat field set the extension fills. Keys are stable; the content script maps them to selectors per ATS. */
export type FillFields = {
  firstName: string; lastName: string; fullName: string; email: string; phone: string | null;
  linkedin: string | null; github: string | null; portfolio: string | null;
  city: string | null; state: string | null; country: string;
  school: string | null; degree: string | null; major: string | null; gradYear: string | null; gpa: string | null;
  workAuthorized: boolean | null; needsSponsorship: boolean | null;
  headline: string | null; summary: string | null;
};

export function fillFields(p: CanonicalProfile): FillFields {
  const parts = p.name.trim().split(/\s+/);
  const loc = p.constraints.locations.find((l) => !/remote/i.test(l)) ?? null;
  const [city, state] = loc ? loc.split(",").map((s) => s.trim()) : [null, null];
  const edu = p.education[0];
  const wa = p.constraints.workAuthorization;
  return {
    firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") || "", fullName: p.name, email: p.email, phone: p.phone,
    linkedin: p.links.linkedin, github: p.links.github, portfolio: p.links.portfolio,
    city: city ?? null, state: state ?? null, country: "United States",
    school: edu?.school ?? null, degree: edu?.degree ?? null, major: edu?.field ?? null, gradYear: edu?.gradYear ? String(edu.gradYear) : null, gpa: edu?.gpa != null ? String(edu.gpa) : null,
    workAuthorized: wa === "unknown" ? null : true, // every listed status can work now; sponsorship is the separate question
    needsSponsorship: wa === "unknown" ? null : wa === "visa_needs_sponsorship",
    headline: p.headline, summary: null,
  };
}
