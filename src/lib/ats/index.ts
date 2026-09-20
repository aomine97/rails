import { ashby } from "./ashby";
import { greenhouse } from "./greenhouse";
import { lever } from "./lever";
import { smartrecruiters } from "./smartrecruiters";
import type { Adapter, AtsKind, CompanyRef, FetchLike, FetchOpts, RawJob } from "./types";
import { usajobs } from "./usajobs";
import { workday } from "./workday";

export * from "./types";

export const adapters: Partial<Record<AtsKind, Adapter>> = { greenhouse, lever, ashby, smartrecruiters, workday, usajobs };

/** Fetch one company's postings, or [] when we have no adapter for its ATS yet. */
export async function fetchCompanyJobs(c: CompanyRef, fetchImpl?: FetchLike, opts?: FetchOpts): Promise<RawJob[]> {
  const a = adapters[c.ats];
  return a ? a.fetchJobs(c, fetchImpl, opts) : [];
}
