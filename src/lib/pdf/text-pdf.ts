import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** Plain, ATS-friendly PDF from resume/letter text: Helvetica, real text (selectable), section headings bold, wrapped lines, page breaks. */
export async function textToPdf(text: string, opts: { title?: string } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  if (opts.title) doc.setTitle(opts.title);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612, H = 792, M = 54, size = 10.5, lead = 14, maxW = W - 2 * M;
  let page = doc.addPage([W, H]); let y = H - M;
  const lines = text.replace(/\r/g, "").split("\n");
  const clean = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, (c) => (c === "•" || c === "●" ? "-" : c === "–" || c === "—" ? "-" : c === "’" ? "'" : c === "“" || c === "”" ? '"' : " "));
  const wrap = (s: string, f: typeof font, sz: number): string[] => {
    const words = s.split(/\s+/); const out: string[] = []; let cur = "";
    for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (f.widthOfTextAtSize(t, sz) > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
  };
  let first = true;
  for (const raw of lines) {
    const line = clean(raw.trimEnd());
    if (!line.trim()) { y -= lead * 0.6; continue; }
    const heading = /^[A-Z][A-Z &/]{2,30}$/.test(line.trim());
    const f = first || heading ? bold : font; const sz = first ? 16 : heading ? 11.5 : size;
    for (const piece of wrap(line, f, sz)) {
      if (y < M + lead) { page = doc.addPage([W, H]); y = H - M; }
      page.drawText(piece, { x: M, y, size: sz, font: f, color: rgb(0.05, 0.1, 0.23) });
      y -= first ? 20 : heading ? lead + 2 : lead;
    }
    if (heading) y -= 2;
    first = false;
  }
  return doc.save();
}
