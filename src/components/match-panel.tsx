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
