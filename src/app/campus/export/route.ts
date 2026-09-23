import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { campusData, staffCampus } from "@/lib/campus/load";
import { campusStats, parseTerm, placementCsv } from "@/lib/campus/stats";

export const dynamic = "force-dynamic";

/** Program-level placement report as CSV. Aggregates only, no student names. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const campus = (await staffCampus(supabase, user.id, url.searchParams.get("c") ?? undefined))[0];
  if (!campus) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const now = new Date(); const term = parseTerm(url.searchParams.get("term") ?? undefined, now);
  const { students, apps } = await campusData(supabaseAdmin(), campus.id);
  const csv = placementCsv(campusStats(students, apps, term, now), term, `${campus.name}, ${campus.school}`);
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="rails-placement-${term.key}.csv"` } });
}
