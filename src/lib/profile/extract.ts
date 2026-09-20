import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const ACCEPTED = { "application/pdf": "pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx" } as const;

/** PDF or DOCX -> plain text. Throws a user-readable message on failure. */
export async function extractResumeText(buf: ArrayBuffer, mime: string, filename: string): Promise<{ text: string; kind: "pdf" | "docx" }> {
  const kind = ACCEPTED[mime as keyof typeof ACCEPTED] ?? (filename.toLowerCase().endsWith(".pdf") ? "pdf" : filename.toLowerCase().endsWith(".docx") ? "docx" : null);
  if (!kind) throw new Error("Upload a PDF or a Word (.docx) file.");
  let text = "";
  if (kind === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const r = await extractText(pdf, { mergePages: true });
    text = Array.isArray(r.text) ? r.text.join("\n") : r.text;
  } else {
    text = (await mammoth.extractRawText({ arrayBuffer: buf })).value;
  }
  text = text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 200) throw new Error("We couldn't read enough text from that file. If it's a scanned image, export it as a text PDF and try again.");
  return { text, kind };
}
