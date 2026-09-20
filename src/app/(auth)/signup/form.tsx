"use client";

import { useActionState, useState } from "react";
import { Field, FormError, PrimaryButton } from "@/components/ui";
import { US_STATES, isEdu } from "@/lib/auth/validate";
import { signUp, type FormState } from "../actions";

export function SignupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, {});
  const [email, setEmail] = useState("");
  if (state.ok) return <p className="rounded-lg bg-green-chip px-3 py-3 text-sm font-medium text-green-chip-text">{state.message}</p>;
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state.errors?.form} />
      <Field label="Name" name="fullName" autoComplete="name" placeholder="Maya Patel" error={state.errors?.fullName} />
      <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@email.vccs.edu" error={state.errors?.email}>
        <input name="email" type="email" autoComplete="email" placeholder="you@email.vccs.edu" value={email} onChange={(e) => setEmail(e.target.value)}
          className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-[15px] text-ink outline-none focus:border-blue focus:ring-2 focus:ring-blue/20" />
      </Field>
      {isEdu(email) && <p className="-mt-2 text-xs font-semibold text-green-chip-text">.edu detected: student price ($15/mo) unlocked on this account.</p>}
      <Field label="Password" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" error={state.errors?.password} />
      <Field label="State" name="state" error={state.errors?.state}>
        <select name="state" defaultValue="VA" className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-[15px] text-ink outline-none focus:border-blue">
          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <p className="text-xs leading-relaxed text-muted">Rails isn&apos;t available in California or New York yet. Everywhere else, you&apos;re in.</p>
      <PrimaryButton pending={pending}>Create my account</PrimaryButton>
    </form>
  );
}
