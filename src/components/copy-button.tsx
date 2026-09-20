"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy", small = false }: { text: string; label?: string; small?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" disabled={!text}
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked; user can select the text */ } }}
      className={`shrink-0 rounded-full border font-semibold disabled:opacity-40 ${small ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-[12px]"} ${done ? "border-green-chip-text bg-green-chip text-green-chip-text" : "border-line bg-surface text-text hover:text-ink"}`}>
      {done ? "Copied" : label}
    </button>
  );
}
