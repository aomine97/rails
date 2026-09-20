import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Wordmark } from "@/components/ui";

/** Placeholder app shell. The feed (screen 3) replaces this in the next item. */
export default async function AppHome() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app");
  const { data: profile } = await supabase.from("profiles").select("full_name,email,edu_verified,state,onboarding_done").eq("id", user.id).single();
  const { count } = await supabase.from("jobs").select("id", { count: "exact", head: true }).is("closed_at", null);
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-3">
        <Wordmark />
        <form action="/auth/signout" method="post"><button className="text-sm font-semibold text-muted">Sign out</button></form>
      </header>
      <section className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Hi {profile?.full_name?.split(" ")[0] || "there"}.</h1>
        <p className="mt-2 text-text">Signed in as {profile?.email ?? user.email}{profile?.edu_verified ? " · student price unlocked" : ""}{profile?.state ? ` · ${profile.state}` : ""}.</p>
        <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
          <div className="font-display text-4xl font-extrabold text-blue">{count?.toLocaleString() ?? "…"}</div>
          <div className="mt-1 text-sm font-semibold text-muted">live tech postings in Rails right now</div>
          <p className="mt-4 text-sm leading-relaxed text-text">Next: upload your resume and confirm your facts. Then this becomes your feed, scored against every one of them.</p>
        </div>
      </section>
    </main>
  );
}
