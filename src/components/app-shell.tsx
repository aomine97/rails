import Link from "next/link";
import type { ReactNode } from "react";
import { PlanChip } from "./plan-chip";

const NAV: { href: string; label: string; badge?: string; soon?: boolean; icon: string }[] = [
  { href: "/app", label: "Jobs", icon: "M4 7h16M4 12h16M4 17h10" },
  { href: "/app/tracker", label: "Tracker", icon: "M4 5h16v14H4zM8 10h8M8 14h5" },
  { href: "/app/autopilot", label: "Autopilot", icon: "M13 2L3 14h7l-1 8 10-12h-7l1-8z" },
  { href: "/app/resume", label: "Resume", icon: "M7 3h7l5 5v13H7zM14 3v5h5M9 13h6M9 17h6" },
  { href: "/app/coach", label: "Coach", soon: true, icon: "M4 5h16v10H8l-4 4z" },
  { href: "/app/interview", label: "Interview", soon: true, icon: "M12 3v10M8 7a4 4 0 008 0M6 21h12" },
  { href: "/app/referrals", label: "Referrals", soon: true, icon: "M16 11a4 4 0 10-8 0M4 21a8 8 0 0116 0" },
];
const FOOT = [
  { href: "/app/billing", label: "Billing", icon: "M3 7h18v10H3zM3 11h18" },
  { href: "/app/settings", label: "Settings", icon: "M12 8a4 4 0 100 8 4 4 0 000-8zM3 12h2M19 12h2M12 3v2M12 19v2" },
];

function Icon({ d }: { d: string }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"><path d={d} /></svg>;
}

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#0B1B3A" /><path d="M7 17V6h4.9c2.3 0 3.7 1.2 3.7 3.2 0 1.4-.7 2.4-2 2.9L16.4 17h-2.5l-2.5-4.6H9.3V17H7zm2.3-6.5h2.4c1.1 0 1.7-.6 1.7-1.5S12.8 7.6 11.7 7.6H9.3v2.9z" fill="#fff" /><rect x="5" y="19" width="14" height="2" rx="1" fill="#FF7A2E" /></svg>
  );
}

/** App frame: labeled sidebar on desktop, bottom tab bar on phones. The page owns its own title; there is no header strip. */
export function AppShell({ children, active = "/app", name, credits, wide = false }: { children: ReactNode; active?: string; name?: string | null; credits?: number | null; wide?: boolean }) {
  const initials = (name ?? "").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "•";
  const item = (n: (typeof NAV)[number]) => (
    <Link key={n.href} href={n.soon ? "#" : n.href} aria-disabled={n.soon} aria-current={active === n.href ? "page" : undefined} title={n.soon ? `${n.label} — coming soon` : n.label}
      className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold ${active === n.href ? "bg-navy-2 text-white" : n.soon ? "cursor-default text-[#7F8FAC]/70" : "text-[#C9D3E4] hover:bg-navy-2/70 hover:text-white"}`}>
      <Icon d={n.icon} /><span>{n.label}</span>
      {n.soon && <span className="ml-auto rounded-md bg-white/10 px-1.5 text-[10px] font-bold uppercase tracking-wide text-[#9FB0CB]">Soon</span>}
      {n.badge && <span className="ml-auto rounded-md bg-orange px-1.5 text-[10px] font-extrabold text-ink">{n.badge}</span>}
    </Link>
  );
  return (
    <div className="flex min-h-screen bg-ground">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col bg-ink px-3 py-4 text-white md:flex">
        <Link href="/app" className="mb-6 flex items-center gap-2.5 px-2 font-display text-[19px] font-extrabold tracking-tight text-white"><Mark /> Rails</Link>
        <nav className="flex flex-col gap-1">{NAV.filter((n) => !n.soon).map(item)}</nav>
        <div className="my-3 border-t border-navy-line" />
        <nav className="flex flex-col gap-1">{NAV.filter((n) => n.soon).map(item)}</nav>
        <div className="mt-auto flex flex-col gap-1">
          {FOOT.map(item)}
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-navy-2/60 px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange text-[12px] font-extrabold text-ink">{initials}</span>
            <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-white">{name ?? "You"}</div><div className="text-[11px] text-[#9FB0CB]"><PlanChip credits={credits} /></div></div>
            <form action="/auth/signout" method="post"><button title="Sign out" aria-label="Sign out" className="text-[#9FB0CB] hover:text-white"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5M15 12H3M21 3v18" /></svg></button></form>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <div className={`mx-auto w-full ${wide ? "max-w-[1440px]" : "max-w-[1180px]"} px-4 pt-6 md:px-8`}>{children}</div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface md:hidden" aria-label="Primary">
        {NAV.filter((n) => !n.soon).map((n) => (
          <Link key={n.href} href={n.href} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active === n.href ? "text-ink" : "text-muted"}`}><Icon d={n.icon} />{n.label}</Link>
        ))}
        <Link href="/app/settings" className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active === "/app/settings" ? "text-ink" : "text-muted"}`}><Icon d="M12 8a4 4 0 100 8 4 4 0 000-8zM3 12h2M19 12h2M12 3v2M12 19v2" />More</Link>
      </nav>
    </div>
  );
}
