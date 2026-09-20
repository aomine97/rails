"use client";

import { useActionState, useState } from "react";
import { FormError, PrimaryButton } from "@/components/ui";
import { pastePosting, type PasteState } from "./actions";

export function PasteForm() {
  const [state, action, pending] = useActionState<PasteState, FormData>(pastePosting, {});
  const [manual, setManual] = useState(false);
  const jsError = state.error?.includes("JavaScript") || state.error?.includes("answered");
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state.error} />
      <label className="flex flex-col gap-1.5 text-sm"><span className="font-semibold">Posting link</span>
        <input name="url" type="url" required placeholder="https://..." className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-[15px] outline-none focus:border-blue" /></label>
      {(manual || jsError) && (<>
        <label className="flex flex-col gap-1.5 text-sm"><span className="font-semibold">Job title</span><input name="title" className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-[15px] outline-none focus:border-blue" /></label>
        <label className="flex flex-col gap-1.5 text-sm"><span className="font-semibold">Paste the description</span><textarea name="text" rows={10} className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[14px] leading-relaxed outline-none focus:border-blue" placeholder="Select all on the posting, copy, paste here." /></label>
      </>)}
      <div className="flex items-center gap-3">
        <PrimaryButton pending={pending}>{pending ? "Reading and scoring (about 15 seconds)…" : "Add and score it"}</PrimaryButton>
        {!manual && !jsError && <button type="button" onClick={() => setManual(true)} className="text-sm font-semibold text-blue">Page won&apos;t load? Paste the text</button>}
      </div>
    </form>
  );
}
