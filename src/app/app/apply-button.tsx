"use client";

import { useRouter } from "next/navigation";
import { APPLY_CLS } from "./jobs/[id]/apply/split";

/** Feed card Apply: a real link to the ATS in a new tab; this tab moves to the apply companion (checklist, copy fields, tailored resume, "Submitted it?"). */
export function ApplyButton({ jobId, url, applied }: { jobId: string; url: string; title?: string; company?: string; applied: boolean }) {
  const router = useRouter();
  if (applied) return <span className="inline-flex h-10 items-center rounded-xl bg-green-chip px-4 text-[13px] font-bold text-green-chip-text">Applied ✓</span>;
  return <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => setTimeout(() => router.push(`/app/jobs/${jobId}/apply`), 50)} className={`${APPLY_CLS} h-10 px-4 text-[13px]`}>Apply with Autofill ↗</a>;
}
