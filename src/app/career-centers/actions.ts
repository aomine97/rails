"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function requestPilot(form: FormData) {
  const s = (k: string, max = 200) => String(form.get(k) ?? "").trim().slice(0, max);
  if (s("website")) redirect("/career-centers?sent=1"); // honeypot
  const name = s("name", 120), email = s("email", 200), school = s("school", 200);
  if (!name || !school || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/career-centers?err=1#pilot");
  await supabaseAdmin().from("campus_requests").insert({ name, email, school, role: s("role", 120) || null, students: s("students", 40) || null, note: s("note", 1500) || null });
  redirect("/career-centers?sent=1#pilot");
}
