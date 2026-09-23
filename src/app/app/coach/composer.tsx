"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { askCoach, type AskState } from "./actions";

function Send() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="h-12 shrink-0 rounded-xl bg-ink px-5 text-[14px] font-bold text-white hover:bg-navy-2 disabled:opacity-60">
      {pending ? "Thinking…" : "Send"}
    </button>
  );
}

/** Composer + suggestion chips. Chips submit the same form, so there is one path to the model. */
export function Composer({ suggestions }: { suggestions: string[] }) {
  const [state, action] = useActionState<AskState, FormData>(askCoach, null);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (!state) { form.current?.reset(); } }, [state]);
  const ask = (q: string) => { if (input.current) { input.current.value = q; form.current?.requestSubmit(); } };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink hover:border-ink">{s}</button>
        ))}
      </div>
      <form ref={form} action={action} className="flex items-end gap-2">
        <label htmlFor="coach-q" className="sr-only">Message Coach</label>
        <textarea id="coach-q" ref={input} name="q" rows={1} maxLength={1500} required
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.current?.requestSubmit(); } }}
          placeholder="Ask anything. Coach answers from your applications, not generic advice."
          className="min-h-12 flex-1 resize-none rounded-xl border border-line-strong bg-surface px-4 py-3 text-[15px] text-ink outline-none focus:border-blue focus:ring-2 focus:ring-blue/20" />
        <Send />
      </form>
      {state?.error && <p className="text-[13px] font-medium text-red">{state.error}</p>}
      {state?.limited && (
        <p className="text-[13px] text-muted">That was today&apos;s 3 free Coach questions. More tomorrow, or <Link href="/pricing?reason=coach" className="font-bold text-ink underline">Pro for unlimited</Link>.</p>
      )}
    </div>
  );
}
