"use client";

import { useRouter } from "next/navigation";
import { openAts } from "./jobs/[id]/apply/split";

/** Feed card Apply: ATS opens in a window on the right, this tab becomes the apply companion (checklist, copy fields, tailored resume, "Submitted it?"). */
export function ApplyButton({ jobId, url, applied }: { jobId: string; url: string; title?: string; company?: string; applied: boolean }) {
  const router = useRouter();
  if (applied) return <span className="rounded-full bg-green-chip px-3 py-2 text-[13px] font-bold text-green-chip-text">Applied ✓</span>;
  return <button type="button" onClick={() => { openAts(url); router.push(`/app/jobs/${jobId}/apply`); }} className="rounded-full bg-orange px-4 py-2 text-[13px] font-extrabold text-ink">Apply now</button>;
}
