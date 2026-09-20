import { describe, expect, it } from "vitest";
import { DAY, followUpFor, funnel, groupByColumn, upNext, type TrackedApp } from "../stages";

const NOW = Date.parse("2026-09-20T12:00:00Z");
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
const app = (p: Partial<TrackedApp>): TrackedApp => ({
  id: p.id ?? "a", title: "SWE Intern", company_name: "Acme", url: null, stage: "applied", applied_at: null,
  last_activity_at: ago(0), next_action: null, next_action_at: null, notes: null, job_id: null, created_at: ago(0), ...p,
});

describe("followUpFor", () => {
  it("returns nothing for a fresh application", () => {
    expect(followUpFor(app({ last_activity_at: ago(2) }), NOW)).toBeNull();
  });
  it("suggests a follow-up after 7 idle days in applied", () => {
    const f = followUpFor(app({ last_activity_at: ago(9) }), NOW);
    expect(f?.kind).toBe("suggested"); expect(f?.days).toBe(9);
  });
  it("uses the explicit reminder when set, and flags overdue", () => {
    expect(followUpFor(app({ next_action: "Email Sam", next_action_at: ago(0) }), NOW)).toMatchObject({ kind: "due", text: "Email Sam" });
    expect(followUpFor(app({ next_action: "Email Sam", next_action_at: ago(3) }), NOW)).toMatchObject({ kind: "overdue", days: 3 });
    expect(followUpFor(app({ next_action_at: ago(-2), last_activity_at: ago(30) }), NOW)).toBeNull();
  });
  it("thank-you nudge after an interview", () => {
    expect(followUpFor(app({ stage: "interview", last_activity_at: ago(4) }), NOW)?.kind).toBe("suggested");
    expect(followUpFor(app({ stage: "interview", last_activity_at: ago(1) }), NOW)).toBeNull();
  });
  it("never nags saved or closed", () => {
    expect(followUpFor(app({ stage: "saved", last_activity_at: ago(40) }), NOW)).toBeNull();
    expect(followUpFor(app({ stage: "rejected", last_activity_at: ago(40) }), NOW)).toBeNull();
  });
});

describe("groupByColumn / funnel / upNext", () => {
  const apps = [
    app({ id: "1", stage: "saved" }), app({ id: "2", stage: "prepared" }),
    app({ id: "3", stage: "applied", last_activity_at: ago(10) }), app({ id: "4", stage: "viewed" }),
    app({ id: "5", stage: "oa" }), app({ id: "6", stage: "interview", last_activity_at: ago(5) }),
    app({ id: "7", stage: "offer" }), app({ id: "8", stage: "rejected" }), app({ id: "9", stage: "withdrawn" }),
  ];
  it("groups into six columns", () => {
    const g = groupByColumn(apps);
    expect(g.saved.map((a) => a.id).sort()).toEqual(["1", "2"]);
    expect(g.applied.map((a) => a.id).sort()).toEqual(["3", "4"]);
    expect(g.closed.map((a) => a.id).sort()).toEqual(["8", "9"]);
    expect(g.offer).toHaveLength(1);
  });
  it("funnel counts and rates", () => {
    const f = funnel(apps);
    expect(f.total).toBe(9); expect(f.applied).toBe(7); expect(f.interviews).toBe(2); expect(f.offers).toBe(1);
    expect(f.interviewRate).toBe(29); expect(f.responseRate).toBe(71);
    expect(funnel([app({ stage: "saved" })]).interviewRate).toBeNull();
  });
  it("upNext orders overdue, due, suggested", () => {
    const list = upNext([
      ...apps,
      app({ id: "10", next_action: "Ping recruiter", next_action_at: ago(2) }),
      app({ id: "11", next_action: "Send thanks", next_action_at: ago(0) }),
    ], NOW);
    expect(list.map((x) => x.app.id)).toEqual(["10", "11", "3", "6"]);
  });
});
