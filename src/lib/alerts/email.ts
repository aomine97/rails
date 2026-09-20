import type { FeedItem } from "../match/feed";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/** Plain, fast-loading email. One line per job with the number; no images. */
export function renderAlert(opts: { name: string | null; items: FeedItem[]; kind: "digest" | "instant"; siteUrl: string; unsubscribeUrl: string }): { subject: string; html: string; text: string } {
  const { items, kind, siteUrl } = opts;
  const top = items[0];
  const subject = kind === "instant"
    ? `${items.length === 1 ? "New match" : `${items.length} new matches`}: ${top.job.title} at ${top.job.companies?.name ?? ""} (${top.score.fit})`
    : `${items.length} new job${items.length === 1 ? "" : "s"} for you today · top fit ${top.score.fit}`;
  const rows = items.map((i) => {
    const url = `${siteUrl}/app/jobs/${i.job.id}`;
    const meta = [i.job.companies?.name, i.job.location].filter(Boolean).join(" · ");
    const color = i.score.fit >= 85 ? "#166534" : i.score.fit >= 70 ? "#D97706" : "#9F1D1D";
    return { url, meta, color, i };
  });
  const html = `<!doctype html><html><body style="margin:0;background:#F4F6FA;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0B1B3A">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="font-weight:800;font-size:18px;margin-bottom:4px">Rails</div>
  <div style="font-size:14px;color:#4B5A73;margin-bottom:16px">${opts.name ? `${esc(opts.name.split(" ")[0])}, ` : ""}${kind === "instant" ? "these just went up and fit you." : "your matches since yesterday, best first."}</div>
  ${rows.map(({ url, meta, color, i }) => `
  <a href="${url}" style="display:block;text-decoration:none;color:inherit;background:#fff;border:1px solid #E3E8F0;border-radius:12px;padding:12px 14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;gap:12px">
      <div style="min-width:0"><div style="font-weight:700;font-size:15px">${esc(i.job.title)}</div><div style="font-size:13px;color:#4B5A73">${esc(meta)}</div>
      ${i.tags.summary ? `<div style="font-size:13px;color:#4B5A73;margin-top:4px">${esc(i.tags.summary.slice(0, 160))}</div>` : ""}</div>
      <div style="font-weight:800;font-size:22px;color:${color};white-space:nowrap">${i.score.fit}</div>
    </div>
  </a>`).join("")}
  <div style="margin:16px 0"><a href="${siteUrl}/app" style="display:inline-block;background:#FF8A3D;color:#0B1B3A;font-weight:800;padding:10px 16px;border-radius:999px;text-decoration:none;font-size:14px">Open your feed</a></div>
  <div style="font-size:12px;color:#8A99B3">Numbers are fit scores out of 100. ${kind === "digest" ? "Pro members get these the hour they post." : ""} <a href="${siteUrl}/app/settings" style="color:#8A99B3">Alert settings</a> · <a href="${opts.unsubscribeUrl}" style="color:#8A99B3">Unsubscribe</a></div>
</div></body></html>`;
  const text = [`Rails: ${subject}`, "", ...rows.map(({ url, meta, i }) => `${i.score.fit}  ${i.job.title} — ${meta}\n    ${url}`), "", `Feed: ${siteUrl}/app`, `Unsubscribe: ${opts.unsubscribeUrl}`].join("\n");
  return { subject, html, text };
}
