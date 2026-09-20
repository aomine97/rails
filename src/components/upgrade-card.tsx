import Link from "next/link";
import { PAYWALL_COPY, PRICES, type PaywallReason } from "@/lib/billing/plans";

/** One of the six moments. Hard=true is the modal-style card; otherwise a banner. Copy comes from plans.ts so every surface agrees. */
export function UpgradeCard({ reason, vars, student }: { reason: PaywallReason; vars: Record<string, string | number>; student?: boolean }) {
  const c = PAYWALL_COPY[reason];
  return (
    <div className={`rounded-2xl border p-5 ${c.hard ? "border-ink bg-ink text-white" : "border-line bg-panel text-ink"}`}>
      <div className="font-display text-lg font-extrabold leading-tight">{c.title(vars)}</div>
      <p className={`mt-1 text-[14px] leading-relaxed ${c.hard ? "text-[#C9D3E4]" : "text-text"}`}>{c.body(vars)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={`/pricing?reason=${reason}`} className="rounded-full bg-orange px-4 py-2 text-[13px] font-extrabold text-ink">{c.cta} · ${student ? PRICES.proMonthlyStudent : PRICES.proMonthly}/mo</Link>
        {c.secondary && <span className={`text-[13px] font-semibold ${c.hard ? "text-[#8A99B3]" : "text-muted"}`}>{c.secondary}</span>}
      </div>
    </div>
  );
}
