import type { Score } from "@/lib/match/score";
import { BAND_COLOR } from "@/lib/match/score";

const GRADE = { strong: "STRONG", good: "GOOD", stretch: "STRETCH" } as const;

/** Ring + three meters, every number shown. Server-renderable SVG. */
export function MatchPanel({ score, compact = false }: { score: Score; compact?: boolean }) {
  const c = BAND_COLOR[score.band];
  const r = 31, C = 2 * Math.PI * r, dash = (C * score.fit) / 100;
  return (
    <div className={`flex ${compact ? "flex-row items-center gap-4" : "flex-col items-center gap-3"} rounded-xl border border-line bg-light p-3`}>
      <div className="flex flex-col items-center">
        <svg width="76" height="76" viewBox="0 0 76 76" aria-label={`Fit ${score.fit} of 100`}>
          <circle cx="38" cy="38" r={r} fill="none" stroke="#DFE6F2" strokeWidth="6" />
          <circle cx="38" cy="38" r={r} fill="none" stroke={c} strokeWidth="6" strokeDasharray={`${dash} ${C}`} strokeLinecap="round" transform="rotate(-90 38 38)" />
          <text x="38" y="43" textAnchor="middle" fontSize="20" fontWeight="800" fill={c} fontFamily="var(--font-inter-tight), var(--font-geist-sans), sans-serif">{score.fit}%</text>
        </svg>
        <div className="font-mono text-[10px] font-bold tracking-widest" style={{ color: c }}>{GRADE[score.band]}</div>
      </div>
      <div className="flex w-full min-w-[150px] flex-col gap-1.5">
        {([["Experience", score.sub.experience], ["Skills", score.sub.skills], ["Field", score.sub.field]] as const).map(([label, v]) => {
          const col = v >= 85 ? BAND_COLOR.strong : v >= 70 ? BAND_COLOR.good : BAND_COLOR.stretch;
          return (
            <div key={label} className="flex items-center gap-2 text-[11px] text-muted">
              <span className="w-[62px]">{label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface"><span className="block h-1.5 rounded-full" style={{ width: `${v}%`, background: col }} /></span>
              <span className="w-7 text-right font-mono text-[11px] font-bold" style={{ color: col }}>{v}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const LEVEL: Record<string, string> = { internship: "Internship", new_grad: "New Grad", entry: "Entry Level", mid: "Mid-Level", senior: "Senior", unknown: "" };
export const levelLabel = (l: string) => LEVEL[l] ?? l;

/** Feed card's right rail: dark panel, ring with the number, grade, and the facts a student checks first. */
export function MatchSide({ score, facts }: { score: Score; facts: { ok: boolean; text: string }[] }) {
  const c = score.band === "strong" ? "#4ADE80" : score.band === "good" ? "#FBBF24" : "#F87171";
  const r = 36, C = 2 * Math.PI * r, dash = (C * score.fit) / 100;
  const grade = score.band === "strong" ? "STRONG MATCH" : score.band === "good" ? "GOOD MATCH" : "STRETCH";
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-[linear-gradient(160deg,#0B1B3A_0%,#13255A_100%)] p-5 text-white">
      <svg width="92" height="92" viewBox="0 0 92 92" aria-label={`Fit ${score.fit} of 100`}>
        <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="7" />
        <circle cx="46" cy="46" r={r} fill="none" stroke={c} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${dash} ${C}`} transform="rotate(-90 46 46)" />
        <text x="46" y="53" textAnchor="middle" fontSize="24" fontWeight="800" fill="#fff" fontFamily="var(--font-inter-tight), var(--font-geist-sans), sans-serif">{score.fit}<tspan fontSize="12" fontWeight="700">%</tspan></text>
      </svg>
      <div className="font-display text-[13px] font-extrabold tracking-wide" style={{ color: c }}>{grade}</div>
      <div className="w-full border-t border-white/15 pt-3">
        <div className="flex flex-col gap-1.5 text-[12px] font-semibold">
          {([["Experience", score.sub.experience], ["Skills", score.sub.skills], ["Field", score.sub.field]] as const).map(([l, v]) => (
            <div key={l} className="flex items-center gap-2"><span className="w-[68px] text-white/70">{l}</span><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"><span className="block h-1.5 rounded-full" style={{ width: `${v}%`, background: v >= 85 ? "#4ADE80" : v >= 70 ? "#FBBF24" : "#F87171" }} /></span><span className="w-7 text-right font-mono">{v}</span></div>
          ))}
        </div>
      </div>
      {facts.length > 0 && (
        <ul className="w-full border-t border-white/15 pt-3 text-[12px] font-semibold">
          {facts.map((f) => <li key={f.text} className={`flex items-start gap-1.5 py-0.5 ${f.ok ? "text-white" : "text-white/70"}`}><span>{f.ok ? "✓" : "!"}</span><span>{f.text}</span></li>)}
        </ul>
      )}
    </div>
  );
}
