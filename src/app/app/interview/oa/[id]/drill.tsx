"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitDrill, type ReviewState } from "../../actions";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="h-11 rounded-xl bg-orange px-5 text-[14px] font-extrabold text-ink disabled:opacity-60">{pending ? "Reviewing…" : "Review my solution"}</button>;
}

export function DrillEditor({ id, minutes, language, initial, hints }: { id: string; minutes: number; language: string; initial: string; hints: string[] }) {
  const [state, action] = useActionState<ReviewState, FormData>(submitDrill, null);
  const [left, setLeft] = useState(minutes * 60);
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = setInterval(() => setLeft((s) => s - 1), 1000); return () => clearInterval(t); }, []);
  const over = left < 0; const a = Math.abs(left);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="flex items-center justify-between text-[13px]"><label htmlFor="code" className="font-semibold text-muted">Your solution · {language}</label><span className={`font-mono font-bold ${over ? "text-red" : left < 300 ? "text-amber" : "text-ink"}`}>{over ? "+" : ""}{Math.floor(a / 60)}:{String(a % 60).padStart(2, "0")}{over ? " over" : " left"}</span></div>
      <textarea id="code" name="code" defaultValue={initial} rows={16} spellCheck={false} onKeyDown={(e) => { if (e.key === "Tab") { e.preventDefault(); const el = e.currentTarget; const s = el.selectionStart; el.setRangeText("    ", s, el.selectionEnd, "end"); } }}
        className="rounded-xl border border-line-strong bg-ink px-4 py-3 font-mono text-[13px] leading-relaxed text-white outline-none focus:ring-2 focus:ring-blue/40" />
      <div className="flex flex-wrap items-center gap-2">
        <Submit />
        {shown < hints.length && <button type="button" onClick={() => setShown((n) => n + 1)} className="h-11 rounded-xl border border-line px-4 text-[14px] font-bold text-ink hover:border-ink">Hint {shown + 1} of {hints.length}</button>}
        {state?.error && <span className="text-[13px] font-medium text-red">{state.error}</span>}
      </div>
      {shown > 0 && <ol className="list-decimal space-y-1 rounded-xl bg-amber-chip px-8 py-3 text-[14px] text-amber-chip-text">{hints.slice(0, shown).map((h, i) => <li key={i}>{h}</li>)}</ol>}
    </form>
  );
}
