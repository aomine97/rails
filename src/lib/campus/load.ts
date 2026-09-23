import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampusApp, CampusStudent } from "./stats";

export type StaffCampus = { id: string; name: string; school: string; edu_domain: string; pilot_until: string | null; paid_until: string | null };

/** The campus this user counsels for (first one, or ?c=). Uses the user's own client: RLS lets staff read their campus. */
export async function staffCampus(db: SupabaseClient, userId: string, want?: string): Promise<StaffCampus[]> {
  const { data } = await db.from("campus_staff").select("campus_id,campuses(id,name,school,edu_domain,pilot_until,paid_until)").eq("user_id", userId);
  const list = ((data ?? []) as unknown as { campuses: StaffCampus | null }[]).map((r) => r.campuses).filter((c): c is StaffCampus => !!c);
  return want ? [...list.filter((c) => c.id === want), ...list.filter((c) => c.id !== want)] : list;
}

/** Service-role read of one campus's students and their applications. Call only after staffCampus() confirmed access. */
export async function campusData(admin: SupabaseClient, campusId: string): Promise<{ students: CampusStudent[]; apps: CampusApp[] }> {
  const { data: ps } = await admin.from("profiles").select("id,full_name,program,created_at,campus_share").eq("campus_id", campusId).eq("onboarding_done", true).limit(5000);
  const students: CampusStudent[] = (ps ?? []).map((p) => ({ id: p.id, name: p.full_name, program: p.program, created_at: p.created_at, share: p.campus_share !== false }));
  const ids = students.map((s) => s.id);
  const apps: CampusApp[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const [{ data: rows }, { data: tailored }] = await Promise.all([
      admin.from("applications").select("user_id,job_id,company_name,title,stage,applied_at,created_at,last_activity_at").in("user_id", chunk).limit(20000),
      admin.from("resumes").select("user_id,job_id").in("user_id", chunk).eq("kind", "tailored").limit(20000),
    ]);
    const t = new Set((tailored ?? []).map((r) => `${r.user_id}:${r.job_id}`));
    for (const r of rows ?? []) apps.push({ ...(r as unknown as CampusApp), tailored: !!r.job_id && t.has(`${r.user_id}:${r.job_id}`) });
  }
  return { students, apps };
}
