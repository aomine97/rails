import Link from "next/link";
import type { ReactNode } from "react";
import { PlanChip } from "./plan-chip";

const NAV: { href: string; label: string; badge?: string; soon?: boolean; icon: string }[] = [
  { href: "/app", label: "Jobs", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/app/tracker", label: "Tracker", icon: "M5 4h14v16H5zM8 9h8M8 13h6" },
  { href: "/app/autopilot", label: "Autopilot", soon: true, icon: "M13 2L3 14h7l-1 8 10-12h-7l1-8z" },
  { href: "/app/resume", label: "Resume", icon: "M7 3h7l5 5v13H7zM14 3v5h5" },
  { href: "/app/coach", label: "Coach", soon: true, icon: "M4 5h16v10H8l-4 4z" },
  { href: "/app/interview", label: "Interview", soon: true, badge: "NEW", icon: "M12 3v10M8 7a4 4 0 008 0M6 21h12" },
  { href: "/app/referrals", label: "Referrals", soon: true, icon: "M16 11a4 4 0 10-8 0M4 21a8 8 0 0116 0" },
  { href: "/app/billing", label: "Billing", icon: "M3 7h18v10H3zM3 11h18" },
  { href: "/app/settings", label: "Settings", soon: true, icon: "M12 8a4 4 0 100 8 4 4 0 000-8zM3 12h2M19 12h2M12 3v2M12 19v2" },
];

export function AppShell({ children, active = "/app", name, credits }: { children: ReactNode; active?: string; name?: string | null; credits?: number | null }) {
  return (
    <div className="flex min-h-screen bg-ground">
      <aside className="sticky top-0 flex h-screen w-[72px] shrink-0 flex-col items-center gap-1 border-r border-line bg-ink py-3 text-white">
        <Link href="/app" className="mb-3 font-display text-lg font-extrabold tracking-tight text-white">R</Link>
        {NAV.map((n) => (
          <Link key={n.href} href={n.soon ? "#" : n.href} aria-disabled={n.soon} title={n.soon ? `${n.label} (coming soon)` : n.label}
            className={`relative flex w-14 flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] font-semibold ${active === n.href ? "bg-navy-2 text-white" : n.soon ? "text-[#8A99B3]/60" : "text-[#C9D3E4] hover:bg-navy-2"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={n.icon} /></svg>
            {n.label}
            {n.badge && <span className="absolute -right-1 top-0 rounded bg-orange px-1 text-[8px] font-extrabold text-ink">{n.badge}</span>}
          </Link>
        ))}
        <div className="mt-auto flex flex-col items-center gap-2 text-[10px] text-[#8A99B3]">
          <PlanChip credits={credits} />
          <form action="/auth/signout" method="post"><button className="text-[10px] font-semibold text-[#8A99B3] hover:text-white">Out</button></form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-3">
          <div className="font-display text-lg font-extrabold tracking-tight">Rails</div>
          <div className="text-sm text-muted">{name}</div>
        </header>
        {children}
      </div>
    </div>
  );
}
