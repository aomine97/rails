"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** The application opens as a real link in a new tab (no window.open, so nothing for a popup blocker to eat); the Rails extension takes over there. */
export const APPLY_CLS = "inline-flex h-11 items-center rounded-xl bg-orange px-5 text-[14px] font-extrabold text-ink shadow-[var(--shadow-cta)] hover:brightness-105 no-underline";

export function SplitApplyButton({ jobId, url, applied }: { jobId: string; url: string; applied: boolean }) {
  const router = useRouter();
  if (applied) return <span className="inline-flex h-11 items-center rounded-xl bg-green-chip px-4 text-[14px] font-bold text-green-chip-text">Applied ✓</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => setTimeout(() => router.push(`/app/jobs/${jobId}/apply`), 50)} className={APPLY_CLS} title="Opens the application in a new tab; this tab becomes your checklist and tailored resume">
      Apply with Autofill ↗
    </a>
  );
}

export function ReopenAts({ url }: { url: string }) {
  return <a href={url} target="_blank" rel="noopener noreferrer" className={APPLY_CLS}>Open application ↗</a>;
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
