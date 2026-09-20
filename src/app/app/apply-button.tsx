"use client";

import { useState } from "react";
import { markApplied } from "./actions";

export function ApplyButton({ jobId, url, title, company, applied }: { jobId: string; url: string; title: string; company: string; applied: boolean }) {
  const [asked, setAsked] = useState(false);
  if (applied) return <span className="rounded-full bg-green-chip px-3 py-2 text-[13px] font-bold text-green-chip-text">Applied ✓</span>;
  if (!asked) return <button type="button" onClick={() => { window.open(url, "_blank", "noopener"); setAsked(true); }} className="rounded-full bg-orange px-4 py-2 text-[13px] font-extrabold text-ink">Apply now</button>;
  return (
    <form action={markApplied} className="flex items-center gap-1.5 rounded-full border border-line bg-light px-2 py-1 text-[12px] font-semibold">
      <input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="url" value={url} /><input type="hidden" name="title" value={title} /><input type="hidden" name="company" value={company} />
      <span className="px-1 text-text">Did you apply?</span>
      <button name="applied" value="1" className="rounded-full bg-ink px-3 py-1 text-white">Yes, applied</button>
      <button name="applied" value="0" className="rounded-full px-2 py-1 text-muted">Not yet</button>
    </form>
  );
}
