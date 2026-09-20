/** Resume-grade punctuation: one space between words, capital first letter, sentence-final period, no doubled or dangling punctuation. */
export function tidyLine(s: string): string {
  return s.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").replace(/([,;:])(?=\S)/g, "$1 ").replace(/\.{2,}/g, ".").replace(/\s+/g, " ").trim();
}
export function sentence(s: string): string {
  const t = tidyLine(s).replace(/[.;,\s]+$/, "");
  if (!t) return "";
  const cap = t[0]!.toUpperCase() + t.slice(1);
  return /[.!?]$/.test(cap) ? cap : `${cap}.`;
}
/** Bullets: capitalized, end with a period, no leading bullet glyphs the model or a PDF left behind. */
export function bullet(s: string): string {
  return sentence(s.replace(/^[\s•\-–—*·▪◦]+/, ""));
}
/** Headlines and titles: no trailing period. */
export function title(s: string): string {
  return tidyLine(s).replace(/[.;,\s]+$/, "");
}
/** Paragraphs: every sentence ends with a period; double spaces collapse. */
export function paragraph(s: string): string {
  return tidyLine(s).split(/(?<=[.!?])\s+/).map((x) => sentence(x)).filter(Boolean).join(" ");
}
