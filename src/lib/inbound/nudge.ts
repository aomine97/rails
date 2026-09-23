import type { FollowUp, TrackedApp } from "../tracker/stages";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Plain email: what to follow up on today, one line each, one link to the tracker. */
export function renderNudge(opts: { name: string | null; items: { app: TrackedApp; f: FollowUp }[]; siteUrl: string; unsubscribeUrl: string }) {
  const first = (opts.name ?? "").split(/\s+/)[0] || "there";
  const n = opts.items.length;
  const subject = `${n} follow-up${n === 1 ? "" : "s"} for today`;
  const lines = opts.items.map(({ app, f }) => `${app.company_name}, ${app.title}: ${f.text}`);
  const text = `Hi ${first},\n\n${lines.map((l) => `- ${l}`).join("\n")}\n\nOpen your tracker: ${opts.siteUrl}/app/tracker\n\nStop these emails: ${opts.unsubscribeUrl}`;
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.55;color:#0B1B3A;max-width:560px">
<p>Hi ${esc(first)},</p><p>${n === 1 ? "One application needs" : `${n} applications need`} a nudge today.</p>
<ul style="padding-left:18px">${opts.items.map(({ app, f }) => `<li style="margin-bottom:6px"><b>${esc(app.company_name)}</b>, ${esc(app.title)}: ${esc(f.text)}</li>`).join("")}</ul>
<p><a href="${opts.siteUrl}/app/tracker" style="display:inline-block;background:#0B1B3A;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700">Open tracker</a></p>
<p style="font-size:12px;color:#5B6B85">You get this because follow-up emails are on. <a href="${opts.unsubscribeUrl}" style="color:#5B6B85">Turn them off</a>.</p></div>`;
  return { subject, html, text };
}
