"use client";

import { useRouter } from "next/navigation";

type Opt = readonly [string, string];
/** Three dropdowns instead of three rows of chips. Each change updates the URL; the page re-renders on the server. */
export function FeedFilters({ levels, fields, where, current, base }: { levels: readonly Opt[]; fields: readonly Opt[]; where: readonly Opt[]; current: { level?: string; field?: string; where?: string; top?: boolean }; base: Record<string, string | undefined> }) {
  const router = useRouter();
  const go = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...base, ...patch, page: "1" })) if (v) p.set(k, v);
    router.push(`/app?${p}`);
  };
  const cls = "h-9 rounded-full border border-line bg-surface pl-3 pr-8 text-xs font-semibold text-ink outline-none focus:border-blue appearance-none bg-no-repeat";
  const arrow = { backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%236B7A93' stroke-width='1.6' stroke-linecap='round'/></svg>\")", backgroundPosition: "right 12px center" };
  const active = "border-ink bg-ink text-white";
  return (
    <div className="flex flex-wrap items-center gap-2 px-6 pt-3">
      <select aria-label="Level" value={current.level ?? ""} onChange={(e) => go({ level: e.target.value })} className={`${cls} ${current.level ? active : ""}`} style={arrow}>
        <option value="">All levels</option>{levels.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <select aria-label="Field" value={current.field ?? ""} onChange={(e) => go({ field: e.target.value })} className={`${cls} ${current.field ? active : ""}`} style={arrow}>
        <option value="">All fields</option>{fields.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <select aria-label="Where" value={current.where ?? "us"} onChange={(e) => go({ where: e.target.value })} className={`${cls} ${current.where && current.where !== "us" ? active : ""}`} style={arrow}>
        {where.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <button type="button" onClick={() => go({ top: current.top ? "" : "1" })} className={`h-9 rounded-full border px-3 text-xs font-semibold ${current.top ? active : "border-line bg-surface text-ink"}`} title="FAANG, top quant and trading firms, the startups everyone applies to">★ Top companies</button>
      {(current.level || current.field || current.top || (current.where && current.where !== "us")) && <button type="button" onClick={() => go({ level: "", field: "", where: "", top: "" })} className="text-xs font-semibold text-muted hover:text-ink">Clear</button>}
    </div>
  );
}
