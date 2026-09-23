import { describe, it, expect } from "vitest";
import { coachContext, coachFacts, coachPlan, momentum, type CoachApp } from "../context";
import { splitSources } from "../reply";

const now = Date.parse("2026-09-23T12:00:00Z");
const ago = (d: number) => new Date(now - d * 86_400_000).toISOString();
const app = (i: number, stage: CoachApp["stage"], tailored: boolean, days = 3): CoachApp => ({
  id: `a${i}`, title: `Role ${i}`, company_name: `Co ${i}`, url: null, stage, applied_at: ago(days), last_activity_at: ago(days),
  next_action: null, next_action_at: null, notes: null, job_id: `j${i}`, created_at: ago(days), tailored,
});

describe("momentum", () => {
  it("is null until each side has 3 applications", () => {
    expect(momentum([app(1, "interview", true), app(2, "applied", false)], now)).toBeNull();
  });
  it("compares tailored and untailored interview rates", () => {
    const apps = [app(1, "interview", true), app(2, "applied", true), app(3, "offer", true), app(4, "applied", true), app(5, "applied", false), app(6, "rejected", false), app(7, "applied", false)];
    const m = momentum(apps, now)!;
    expect(m.withRate).toBe(50);
    expect(m.withoutRate).toBe(0);
    expect(m.withN).toBe(4);
  });
});

describe("coachFacts / plan / context", () => {
  const apps = [app(1, "applied", false, 12), app(2, "interview", true, 2), app(3, "saved", false, 1)];
  const f = coachFacts(null, apps, now, 64);
  it("finds quiet applications and counts applied", () => {
    expect(f.quiet.map((q) => q.company)).toEqual(["Co 1"]);
    expect(f.funnel.applied).toBe(2);
  });
  it("plan reflects state", () => {
    const steps = coachPlan(f);
    expect(steps[0]).toMatchObject({ done: false, detail: "Now 64" });
    expect(steps[3]!.done).toBe(false);
  });
  it("context numbers the rows so answers can cite them", () => {
    const c = coachContext(f, apps, now);
    expect(c).toContain("1. Co 1 | Role 1 | Applied");
    expect(c).toContain("not enough data yet");
  });
});

describe("splitSources", () => {
  it("pulls the SOURCES line off the end", () => {
    expect(splitSources("Answer.\n\nSOURCES: 2, 5")).toEqual({ text: "Answer.", sources: ["2", "5"] });
    expect(splitSources("No sources here")).toEqual({ text: "No sources here", sources: [] });
  });
});
