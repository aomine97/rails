"use client";

import Link from "next/link";
import { useState } from "react";
import { STAGES, STAGE_LABEL, daysSince, type Stage, type TrackedApp } from "@/lib/tracker/stages";
import { removeApplication, saveNote, setReminder, setStage } from "./actions";

const STAGE_TONE: Partial<Record<Stage, string>> = {
  offer: "bg-green-chip text-green-chip-text", interview: "bg-green-chip text-green-chip-text", oa: "bg-amber-chip text-amber-chip-text",
  rejected: "bg-red-chip text-red-chip-text", withdrawn: "bg-light text-muted",
};

export function TrackerCard({ app, now }: { app: TrackedApp; now: number }) {
  const [open, setOpen] = useState(false);
  const idle = daysSince(app.last_activity_at, now) ?? 0;
  const due = app.next_action_at ? daysSince(app.next_action_at, now) ?? 0 : null;
  const dueDate = app.next_action_at ? app.next_action_at.slice(0, 10) : "";
  return (
    <div className="rounded-xl border border-line bg-surface p-3 text-[13px] shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-bold text-ink">{app.company_name}</div>
          <div className="truncate text-text">{app.job_id ? <Link href={`/app/jobs/${app.job_id}`} className="hover:underline">{app.title}</Link> : app.title}</div>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold text-muted hover:text-ink" aria-expanded={open}>{open ? "Close" : "Edit"}</button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <form action={setStage}>
          <input type="hidden" name="id" value={app.id} />
          <select name="stage" defaultValue={app.stage} onChange={(e) => e.currentTarget.form?.requestSubmit()} aria-label="Stage"
            className={`rounded-full border border-line px-2 py-0.5 font-bold ${STAGE_TONE[app.stage] ?? "bg-light text-ink"}`}>
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </select>
        </form>
        <span className="text-muted">{idle === 0 ? "today" : `${idle}d idle`}</span>
        {due != null && (
          <span className={`rounded-full px-2 py-0.5 font-semibold ${due > 0 ? "bg-red-chip text-red-chip-text" : due === 0 ? "bg-amber-chip text-amber-chip-text" : "bg-light text-text"}`}>
            {due > 0 ? `${due}d overdue` : due === 0 ? "due today" : `in ${-due}d`}: {app.next_action}
          </span>
        )}
        {app.notes && !open && <span className="truncate text-muted" title={app.notes}>• {app.notes.slice(0, 40)}{app.notes.length > 40 ? "…" : ""}</span>}
        {app.url && <a href={app.url} target="_blank" rel="noopener" className="ml-auto text-muted hover:text-ink">Posting ↗</a>}
      </div>
      {open && (
        <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
          <form action={saveNote} className="flex flex-col gap-1.5">
            <input type="hidden" name="id" value={app.id} />
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted" htmlFor={`n-${app.id}`}>Notes</label>
            <textarea id={`n-${app.id}`} name="notes" defaultValue={app.notes ?? ""} rows={3} placeholder="Recruiter name, what they asked, what you promised to send…" className="w-full rounded-lg border border-line bg-light px-2.5 py-2 text-[13px]" />
            <button className="self-end rounded-full bg-ink px-3 py-1 text-[12px] font-bold text-white">Save note</button>
          </form>
          <form action={setReminder} className="flex flex-col gap-1.5">
            <input type="hidden" name="id" value={app.id} />
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted" htmlFor={`w-${app.id}`}>Remind me</label>
            <div className="flex flex-wrap gap-1.5">
              <input id={`w-${app.id}`} name="what" defaultValue={app.next_action ?? ""} placeholder="Follow up with recruiter" className="min-w-0 flex-1 rounded-lg border border-line bg-light px-2.5 py-1.5 text-[13px]" />
              <input name="when" type="date" defaultValue={dueDate} aria-label="Reminder date" className="rounded-lg border border-line bg-light px-2 py-1.5 text-[13px]" />
              <button className="rounded-full bg-ink px-3 py-1 text-[12px] font-bold text-white">Set</button>
            </div>
            <div className="text-[11px] text-muted">Leave the date empty and press Set to clear it. Reminders show in Up next and on the Jobs page.</div>
          </form>
          <form action={removeApplication} className="flex justify-end">
            <input type="hidden" name="id" value={app.id} />
            <button className="text-[11px] font-semibold text-muted hover:text-red-chip-text" onClick={(e) => { if (!confirm("Remove this application from the tracker?")) e.preventDefault(); }}>Remove</button>
          </form>
        </div>
      )}
    </div>
  );
}
