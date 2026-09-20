/** One employer's careers feed. Mirrors data/companies.json and the `companies` table. */
export type AtsKind =
  | "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workday" | "usajobs"
  | "icims" | "oracle" | "workable" | "jobvite" | "taleo" | "unknown";

export interface CompanyRef {
  id?: string;
  name: string;
  ats: AtsKind;
  /** board token / posting slug / workday site name */
  slug: string | null;
  /** workday only */
  tenant?: string | null;
  wdn?: number | null;
  careersUrl?: string | null;
}

/** What every adapter returns. The normalizer turns this into a `jobs` row. */
export interface RawJob {
  ats: AtsKind;
  companySlug: string;
  externalId: string;
  title: string;
  location: string | null;
  remote: boolean | null;
  employmentType: string | null;
  department: string | null;
  descriptionHtml: string | null;
  descriptionText: string | null;
  /** page a human opens */
  url: string;
  /** direct apply link if the ATS exposes one, else same as url */
  applyUrl: string;
  postedAt: string | null; // ISO
  pay: { min: number | null; max: number | null; currency: string | null; period: "hour" | "year" | null } | null;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface FetchOpts {
  /** skip per-posting detail requests (Workday, SmartRecruiters); descriptions come back null */
  listOnly?: boolean;
  /** stop after this many postings */
  maxJobs?: number;
}

export interface Adapter {
  kind: AtsKind;
  fetchJobs(company: CompanyRef, fetchImpl?: FetchLike, opts?: FetchOpts): Promise<RawJob[]>;
  /** fill description/details for one posting fetched with listOnly (only ATSs that need a second request) */
  enrich?(company: CompanyRef, job: RawJob, fetchImpl?: FetchLike): Promise<RawJob>;
}

export class AdapterError extends Error {
  constructor(public readonly ats: AtsKind, public readonly company: string, message: string, public readonly status?: number) {
    super(`[${ats}:${company}] ${message}`);
  }
}
