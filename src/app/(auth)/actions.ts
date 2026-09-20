"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LoginInput, SignupInput, WaitlistInput, fieldErrors } from "@/lib/auth/validate";
import { isGated } from "@/lib/geo";

export type FormState = { errors?: Record<string, string>; message?: string; ok?: boolean };

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = SignupInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { fullName, email, password, state } = parsed.data;
  if (isGated(state)) redirect(`/not-yet?state=${state}`);
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName, state }, emailRedirectTo: `${await origin()}/auth/callback?next=/app` },
  });
  if (error) return { errors: { form: error.message } };
  // Email confirmation on: no session yet
  if (!data.session) return { ok: true, message: `Check ${email} for a confirmation link, then sign in.` };
  redirect("/app");
}

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = LoginInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { errors: { form: error.message === "Invalid login credentials" ? "Wrong email or password." : error.message } };
  const next = String(form.get("next") ?? "/app");
  redirect(next.startsWith("/") ? next : "/app");
}

export async function signInWithGoogle(form: FormData) {
  const supabase = await supabaseServer();
  const next = String(form.get("next") ?? "/app");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next.startsWith("/") ? next : "/app")}` },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent(error?.message ?? "Google sign-in is not configured yet")}`);
  redirect(data.url);
}

export async function joinWaitlist(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = WaitlistInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { error } = await supabaseAdmin().from("waitlist").upsert({ email: parsed.data.email, state: parsed.data.state ?? null }, { onConflict: "email" });
  if (error) return { errors: { form: "Could not save that. Try again." } };
  return { ok: true, message: "You're on the list. We'll email you the day Rails opens in your state." };
}
