import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extUser, CORS, preflight } from "@/lib/ext/auth";
import { textToPdf } from "@/lib/pdf/text-pdf";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

const safe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "Resume";

/**
 * ?jobId=&kind=resume|letter -> the file the extension attaches to the form.
 * resume: the tailored version for this job as a PDF when one exists, else the original upload as-is.
 * letter: the cover letter for this job as a PDF (404 when none).
 */
export async function GET(req: Request) {
  const u = await extUser(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  const url = new URL(req.url); const jobId = url.searchParams.get("jobId"); const kind = url.searchParams.get("kind") === "letter" ? "letter" : "resume";
  const db = supabaseAdmin();
  const { data: prof } = await db.from("profiles").select("full_name").eq("id", u.id).single();
  const name = safe(prof?.full_name ?? "Resume");
  if (kind === "letter") {
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400, headers: CORS });
    const { data: app } = await db.from("applications").select("cover_letter,company_name").eq("user_id", u.id).eq("job_id", jobId).maybeSingle();
    if (!app?.cover_letter) return NextResponse.json({ error: "no letter" }, { status: 404, headers: CORS });
    const pdf = await textToPdf(app.cover_letter, { title: `Cover letter - ${app.company_name}` });
    return new NextResponse(Buffer.from(pdf), { headers: { ...CORS, "content-type": "application/pdf", "x-rails-filename": `${name}_Cover_Letter_${safe(app.company_name)}.pdf`, "access-control-expose-headers": "x-rails-filename, x-rails-kind" , "x-rails-kind": "letter" } });
  }
  if (jobId) {
    const { data: t } = await db.from("resumes").select("text_content,score").eq("user_id", u.id).eq("job_id", jobId).eq("kind", "tailored").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (t?.text_content) {
      const { data: job } = await db.from("jobs").select("companies(name)").eq("id", jobId).single();
      const co = safe((job?.companies as unknown as { name: string } | null)?.name ?? "");
      const pdf = await textToPdf(t.text_content, { title: `${prof?.full_name ?? ""} resume` });
      return new NextResponse(Buffer.from(pdf), { headers: { ...CORS, "content-type": "application/pdf", "x-rails-filename": `${name}_Resume${co ? `_${co}` : ""}.pdf`, "x-rails-kind": "tailored", "access-control-expose-headers": "x-rails-filename, x-rails-kind" } });
    }
  }
  const { data: base } = await db.from("resumes").select("storage_path").eq("user_id", u.id).eq("kind", "base").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!base?.storage_path) return NextResponse.json({ error: "no resume" }, { status: 404, headers: CORS });
  const { data: file, error } = await db.storage.from("resumes").download(base.storage_path);
  if (error || !file) return NextResponse.json({ error: "download failed" }, { status: 500, headers: CORS });
  const ext = base.storage_path.split(".").pop()?.toLowerCase() ?? "pdf";
  const ct = ext === "pdf" ? "application/pdf" : ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : file.type || "application/octet-stream";
  return new NextResponse(Buffer.from(await file.arrayBuffer()), { headers: { ...CORS, "content-type": ct, "x-rails-filename": `${name}_Resume.${ext}`, "x-rails-kind": "base", "access-control-expose-headers": "x-rails-filename, x-rails-kind" } });
}
