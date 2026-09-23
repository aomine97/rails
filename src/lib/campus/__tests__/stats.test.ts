import { describe, it, expect } from "vitest";
import { campusStats, parseTerm, placementCsv, termOf, type CampusApp, type CampusStudent } from "../stats";

const now = new Date("2026-10-15T12:00:00Z");
const d = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const S = (id: string, program: string, joined: number, share = true): CampusStudent => ({ id, name: `Student ${id}`, program, created_at: d(joined), share });
const A = (u: string, co: string, stage: CampusApp["stage"], days = 10, tailored = false): CampusApp => ({ user_id: u, company_name: co, title: "IT Support Intern", stage, applied_at: d(days), created_at: d(days), last_activity_at: d(days), tailored });

describe("terms", () => {
  it("maps months to terms", () => {
    expect(termOf(now).label).toBe("Fall 2026");
    expect(termOf(new Date("2027-03-01")).label).toBe("Spring 2027");
    expect(parseTerm("spring-2026", now).label).toBe("Spring 2026");
    expect(parseTerm("junk", now).key).toBe("fall-2026");
  });
});

describe("campusStats", () => {
  const students = [S("1", "IST Cloud", 40), S("2", "IST Cloud", 30), S("3", "CS", 20), S("4", "CS", 20, false)];
  const apps = [
    ...Array.from({ length: 16 }, () => A("1", "Acme", "applied")),
    A("2", "Leidos", "interview"), A("2", "Leidos", "offer"), A("2", "SAIC", "rejected"),
  ];
  const s = campusStats(students, apps, termOf(now), now);
  it("aggregates the term", () => {
    expect(s.headline).toMatchObject({ students: 4, active: 2, applied: 19, interviews: 2, offers: 1 });
    expect(s.byProgram.find((p) => p.name === "IST Cloud")).toMatchObject({ students: 2, apps: 19 });
    expect(s.employers[0]).toMatchObject({ name: "Leidos", offers: 1 });
  });
  it("flags who needs help and respects opt-out", () => {
    const why = Object.fromEntries(s.flags.map((f) => [f.id, f.why]));
    expect(why["1"]).toContain("16 applications, no replies");
    expect(why["3"]).toContain("no applications yet");
    expect(why["4"]).toBeUndefined();
  });
  it("CSV has no student names", () => {
    const csv = placementCsv(s, termOf(now), "NOVA");
    expect(csv).toContain("IST Cloud");
    expect(csv).not.toContain("Student 1");
  });
});
