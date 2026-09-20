import type { CanonicalProfile } from "@/lib/schemas/profile";

const STATE_NAMES: Record<string, string> = { AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming" };

/** Map a major to the discipline labels forms tend to use (multi-select on Greenhouse). */
export function disciplinesFor(major: string | null | undefined): string[] {
  const m = (major ?? "").toLowerCase(); const out = new Set<string>();
  const add = (...xs: string[]) => xs.forEach((x) => out.add(x));
  if (/information systems|information technology|\bist\b|\bit\b/.test(m)) add("Information Technology", "Information Systems");
  if (/cloud|network|cyber|security/.test(m)) add("Information Technology", "Cybersecurity");
  if (/computer science|\bcs\b/.test(m)) add("Computer Science");
  if (/software/.test(m)) add("Software Engineering");
  if (/computer engineering/.test(m)) add("Computer Engineering");
  if (/data science|analytics/.test(m)) add("Data Science");
  if (/machine learning|artificial intelligence|\bai\b/.test(m)) add("Machine Learning", "Artificial Intelligence");
  if (/electrical/.test(m)) add("Electrical Engineering");
  if (/math/.test(m)) add("Mathematics");
  if (/statistic/.test(m)) add("Statistics");
  if (/business/.test(m)) add("Business Administration");
  if (/finance/.test(m)) add("Finance");
  if (/economics/.test(m)) add("Economics");
  return [...out];
}

/** The flat field set the extension fills. Keys are stable; the content script maps them to selectors per ATS. */
export type FillFields = {
  firstName: string; lastName: string; fullName: string; preferredName: string | null; email: string; phone: string | null; phoneCountry: string;
  linkedin: string | null; github: string | null; portfolio: string | null;
  street: string | null; city: string | null; state: string | null; stateName: string | null; zip: string | null; country: string;
  school: string | null; degree: string | null; degreeName: string | null; major: string | null; disciplines: string[]; startYear: string | null; gradYear: string | null; gradMonth: string | null; gradDate: string | null; gpa: string | null;
  workAuthorized: boolean | null; needsSponsorship: boolean | null;
  headline: string | null; summary: string | null;
};

const DEGREE_NAMES: Record<string, string> = { AAS: "Associate's Degree", AS: "Associate's Degree", AA: "Associate's Degree", BS: "Bachelor's Degree", BA: "Bachelor's Degree", BAS: "Bachelor's Degree", BSC: "Bachelor's Degree", MS: "Master's Degree", MA: "Master's Degree", MBA: "Master's Degree", PHD: "Doctorate" };

export function fillFields(p: CanonicalProfile): FillFields {
  const parts = p.name.trim().split(/\s+/);
  const loc = p.constraints.locations.find((l) => !/remote/i.test(l)) ?? null;
  const [locCity, locState] = loc ? loc.split(",").map((s) => s.trim()) : [null, null];
  const city = p.address.city ?? locCity ?? null;
  const stateRaw = (p.address.state ?? locState ?? "").trim().toUpperCase().slice(0, 2);
  const state = STATE_NAMES[stateRaw] ? stateRaw : null;
  const edu = p.education[0];
  const wa = p.constraints.workAuthorization;
  const deg = (edu?.degree ?? "").replace(/[.\s]/g, "").toUpperCase();
  return {
    firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") || "", fullName: p.name, preferredName: p.preferredName, email: p.email, phone: p.phone, phoneCountry: "United States",
    linkedin: p.links.linkedin, github: p.links.github, portfolio: p.links.portfolio,
    street: p.address.street, city, state, stateName: state ? STATE_NAMES[state] : null, zip: p.address.zip, country: "United States",
    school: edu?.school ?? null, degree: edu?.degree ?? null, degreeName: DEGREE_NAMES[deg] ?? edu?.degree ?? null, major: edu?.field ?? null, disciplines: disciplinesFor(edu?.field),
    startYear: edu?.startYear ? String(edu.startYear) : null, gradYear: edu?.gradYear ? String(edu.gradYear) : null, gradMonth: edu?.gradYear ? "May" : null, gradDate: edu?.gradYear ? `May ${edu.gradYear}` : null, gpa: edu?.gpa != null ? String(edu.gpa) : null,
    workAuthorized: wa === "unknown" ? null : true, // every listed status can work now; sponsorship is the separate question
    needsSponsorship: wa === "unknown" ? null : wa === "visa_needs_sponsorship",
    headline: p.headline, summary: null,
  };
}
