"use client";

import { useActionState } from "react";
import { Field, FormError, PrimaryButton } from "@/components/ui";
import { signIn, type FormState } from "../actions";

export function LoginForm({ next, oauthError }: { next?: string; oauthError?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? "/app"} />
      <FormError message={state.errors?.form ?? oauthError} />
      <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@email.vccs.edu" error={state.errors?.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" error={state.errors?.password} />
      <PrimaryButton pending={pending} kind="blue">Sign in</PrimaryButton>
    </form>
  );
}
