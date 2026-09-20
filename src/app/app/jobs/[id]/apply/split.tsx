"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Opens the ATS in a normal tab next to this one. Not a popup: Chrome gives popup windows no side panel, so the Rails extension could not run there. */
export function openAts(url: string) {
  return window.open(url, "_blank", "noopener");
}

export function SplitApplyButton({ jobId, url, applied }: { jobId: string; url: string; applied: boolean }) {
  const router = useRouter();
  if (applied) return <span className="rounded-full bg-green-chip px-3 py-2 text-[13px] font-bold text-green-chip-text">Applied ✓</span>;
  return (
    <button type="button" onClick={() => { openAts(url); router.push(`/app/jobs/${jobId}/apply`); }} className="rounded-full bg-orange px-4 py-2 text-[13px] font-extrabold text-ink" title="Opens the application in a new tab; keep this tab for the checklist and tailored resume, and use the Rails extension over there">
      Apply now
    </button>
  );
}

export function ReopenAts({ url }: { url: string }) {
  return <button type="button" onClick={() => openAts(url)} className="rounded-full bg-orange px-4 py-2 text-[13px] font-extrabold text-ink">Open application ↗</button>;
}

export function Checklist({ items }: { items: { text: string; required: boolean; evidence: string | null }[] }) {
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));
  const n = done.filter(Boolean).length;
  return (
    <div>
      <div className="flex items-center justify-between"><h2 className="text-[11px] font-bold uppercase tracking-wide text-muted">Requirements</h2><span className="font-mono text-[11px] font-bold text-ink">{n}/{items.length}</span></div>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((r, i) => (
          <li key={i} className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[13px] ${done[i] ? "border-green-chip bg-green-chip/40" : "border-line bg-surface"}`}>
            <input type="checkbox" checked={done[i]} onChange={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))} className="mt-0.5" aria-label={r.text} />
            <div className="min-w-0">
              <div className={done[i] ? "text-muted line-through" : "text-ink"}>{r.text} {!r.required && <span className="text-[11px] text-muted">(preferred)</span>}</div>
              {r.evidence && <div className="text-[11px] text-green-chip-text">You bring: {r.evidence}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
