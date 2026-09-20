"use client";

import { useActionState } from "react";
import { Field, FormError, PrimaryButton } from "@/components/ui";
import { joinWaitlist, type FormState } from "../(auth)/actions";

export function WaitlistForm({ state }: { state?: string }) {
  const [s, action, pending] = useActionState<FormState, FormData>(joinWaitlist, {});
  if (s.ok) return <p className="rounded-lg bg-green-chip px-3 py-3 text-sm font-medium text-green-chip-text">{s.message}</p>;
  return (
    <form action={action} className="flex flex-col gap-4">
      {state && <input type="hidden" name="state" value={state} />}
      <FormError message={s.errors?.form} />
      <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@school.edu" error={s.errors?.email} />
      <PrimaryButton pending={pending} kind="blue">Tell me when it opens</PrimaryButton>
    </form>
  );
}
