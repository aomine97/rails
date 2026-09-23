"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitAnswer, type GradeState } from "./actions";

type Rec = { start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; continuous: boolean; interimResults: boolean; lang: string };

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="h-11 rounded-xl bg-orange px-5 text-[14px] font-extrabold text-ink shadow-[var(--shadow-cta)] disabled:opacity-60">{pending ? "Listening to it…" : "Get feedback"}</button>;
}

/** Type or talk. Talking uses the browser's own speech recognition (Chrome), so audio never leaves the browser for Rails. */
export function AnswerBox({ session, q }: { session: string; q: number }) {
  const [state, action] = useActionState<GradeState, FormData>(submitAnswer, null);
  const [text, setText] = useState("");
  const [rec, setRec] = useState<Rec | null>(null);
  const [secs, setSecs] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); rec?.stop(); }, [rec]);
  const supported = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  const talk = () => {
    if (rec) { rec.stop(); return; }
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const R = W.SpeechRecognition ?? W.webkitSpeechRecognition; if (!R) return;
    const r = new R(); r.continuous = true; r.interimResults = false; r.lang = "en-US";
    r.onresult = (e) => { let add = ""; for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i]!.isFinal) add += e.results[i]![0]!.transcript + " "; if (add) setText((t) => (t + " " + add).trim()); };
    r.onend = () => { setRec(null); if (timer.current) clearInterval(timer.current); };
    r.start(); setRec(r); setSecs(0);
    timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
  };
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="session" value={session} /><input type="hidden" name="q" value={q} />
      <label htmlFor="answer" className="text-[13px] font-semibold text-muted">Your answer{rec ? ` · recording ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : ""}</label>
      <textarea id="answer" name="answer" value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder="Answer as you would out loud. Filler words are counted, so type them if you'd say them."
        className="rounded-xl border border-line-strong bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink outline-none focus:border-blue focus:ring-2 focus:ring-blue/20" />
      <div className="flex flex-wrap items-center gap-2">
        {supported && <button type="button" onClick={talk} className={`h-11 rounded-xl border px-4 text-[14px] font-bold ${rec ? "border-red bg-red text-white" : "border-line text-ink hover:border-ink"}`}>{rec ? "Stop recording" : "Answer out loud"}</button>}
        <Submit />
        {state?.error && <span className="text-[13px] font-medium text-red">{state.error}</span>}
      </div>
    </form>
  );
}
