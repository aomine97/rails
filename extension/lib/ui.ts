/** Shared SVG bits for the panel and the on-page badge. Every meter shows its number. */
export const BAND = { green: "#166534", amber: "#D97706", red: "#9F1D1D", none: "#6B7A93" } as const;
export const bandOf = (v: number | null | undefined) => (v == null ? "none" : v >= 85 ? "green" : v >= 70 ? "amber" : "red") as keyof typeof BAND;
export const bandLabel = (v: number | null | undefined) => (v == null ? "" : v >= 85 ? "STRONG" : v >= 70 ? "GOOD" : "STRETCH");

/** Progress ring with the number in the middle. `size` px; stroke scales with it. */
export function ring(value: number | null | undefined, size = 72, opts: { suffix?: string; label?: string; color?: string; track?: string; stroke?: number } = {}): string {
  const s = opts.stroke ?? Math.max(4, Math.round(size / 12)); const r = (size - s) / 2; const C = 2 * Math.PI * r; const v = Math.max(0, Math.min(100, value ?? 0));
  const color = opts.color ?? BAND[bandOf(value)]; const track = opts.track ?? "#E3E8F0"; const half = size / 2;
  const text = value == null ? "—" : `${value}${opts.suffix ?? ""}`; const fs = Math.round(size * (text.length > 3 ? 0.24 : 0.3));
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${opts.label ?? ""} ${text}">
    <circle cx="${half}" cy="${half}" r="${r}" fill="none" stroke="${track}" stroke-width="${s}"/>
    <circle cx="${half}" cy="${half}" r="${r}" fill="none" stroke="${color}" stroke-width="${s}" stroke-linecap="round" stroke-dasharray="${(C * v) / 100} ${C}" transform="rotate(-90 ${half} ${half})" style="transition:stroke-dasharray .6s ease"/>
    <text x="${half}" y="${half + fs * 0.36}" text-anchor="middle" font-size="${fs}" font-weight="800" fill="${color}" font-family="-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">${text}</text>
  </svg>`;
}

/** Horizontal meter: label, bar, number. */
export function meter(label: string, value: number): string {
  const c = BAND[bandOf(value)];
  return `<div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#6B7A93"><span style="width:64px">${label}</span><span style="flex:1;height:6px;border-radius:999px;background:#E3E8F0;overflow:hidden"><span style="display:block;height:6px;border-radius:999px;width:${Math.max(0, Math.min(100, value))}%;background:${c};transition:width .6s ease"></span></span><span style="width:26px;text-align:right;font-weight:800;color:${c}">${value}</span></div>`;
}

/** Rails mark: orange rounded square with an ink "R" and a rail line. Inline so it needs no web-accessible resource. */
export function logo(size = 20): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#FF8A3D"/><path d="M7 18V6h5.2c2.4 0 3.9 1.3 3.9 3.4 0 1.5-.8 2.6-2.2 3.1L17 18h-2.7l-2.7-5H9.4v5H7zm2.4-7h2.6c1.2 0 1.8-.6 1.8-1.6S13.2 8 12 8H9.4v3z" fill="#0B1B3A"/></svg>`;
}
