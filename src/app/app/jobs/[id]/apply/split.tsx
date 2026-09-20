"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Opens the ATS in a window on the right half of the screen; this tab shows the apply companion on the left. */
export function openAts(url: string) {
  const w = window.screen.availWidth, h = window.screen.availHeight;
  const atsW = Math.max(700, Math.round(w * 0.56));
  const win = window.open(url, "rails-ats", `popup=yes,width=${atsW},height=${h},left=${w - atsW},top=0`);
  try { window.resizeTo(w - atsW, h); window.moveTo(0, 0); } catch { /* browsers ignore this for non-popups; fine */ }
  return win;
}

export function SplitApplyButton({ jobId, url, applied }: { jobId: string; url: string; applied: boolean }) {
  const router = useRouter();
  if (applied) return <span className="rounded-full bg-green-chip px-3 py-2 text-[13px] font-bold text-green-chip-text">Applied ✓</span>;
  return (
    <button type="button" onClick={() => { openAts(url); router.push(`/app/jobs/${jobId}/apply`); }} className="rounded-full bg-orange px-4 py-2 text-[13px] font-extrabold text-ink" title="Opens the application next to your checklist and tailored resume">
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
