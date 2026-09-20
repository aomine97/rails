import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { planOf } from "@/lib/billing/entitlements";

/** Sidebar chip: credit count on Free, plan name on paid. Async server component so pages do not have to thread the plan through. */
export async function PlanChip({ credits }: { credits?: number | null }) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const plan = await planOf(supabase, user.id);
  if (plan === "free") {
    if (credits == null) return null;
    return <Link href="/app/billing" title={`${credits} AI credits (tailor, cover letter, mock set). Refill every 3 days.`} className="rounded-full bg-navy-2 px-2 py-0.5 font-mono text-[11px] font-bold text-orange">{credits}</Link>;
  }
  const label = plan === "pro" ? "PRO" : plan === "semester" ? "PASS" : "CAMPUS";
  return <Link href="/app/billing" title="Unlimited AI credits" className="rounded-full bg-orange px-2 py-0.5 font-mono text-[10px] font-extrabold text-ink">{label}</Link>;
}
