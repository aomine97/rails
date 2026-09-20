"use client";

import { useActionState, useState } from "react";
import { FormError, PrimaryButton } from "@/components/ui";
import { uploadResume, type UploadState } from "./actions";

export function UploadForm() {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadResume, {});
  const [name, setName] = useState<string | null>(null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state.error} />
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-surface px-6 py-12 text-center hover:border-blue">
        <input type="file" name="resume" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(e) => setName(e.target.files?.[0]?.name ?? null)} />
        <span className="font-display text-lg font-extrabold">{name ?? "Choose your resume"}</span>
        <span className="text-sm text-muted">{name ? "Ready. Hit the button." : "PDF or .docx"}</span>
      </label>
      <PrimaryButton pending={pending}>{pending ? "Reading your resume (about 20 seconds)…" : "Read my resume"}</PrimaryButton>
    </form>
  );
}
