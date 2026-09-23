import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell, ALL_NAV } from "@/components/app-shell";

export const dynamic = "force-dynamic";

/** Phones: every screen the tab bar has no room for. */
export default async function More() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/more");
  const { data: p } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  return (
    <AppShell active="/app/more" name={p?.full_name}>
      <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-ink">More</h1>
      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {ALL_NAV().map((n) => (
          <li key={n.href}><Link href={n.href} className="flex h-14 items-center gap-3 px-4 text-[15px] font-semibold text-ink hover:bg-ground">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={n.icon} /></svg>{n.label}<span className="ml-auto text-muted">›</span>
          </Link></li>
        ))}
        <li><form action="/auth/signout" method="post"><button className="flex h-14 w-full items-center px-4 text-[15px] font-semibold text-muted">Sign out</button></form></li>
      </ul>
    </AppShell>
  );
}
