import { describe, it, expect } from "vitest";
import { fillers, novelty, gradeAnswer } from "../feedback";
import { pickTopic, Drill } from "../oa";
import { fitNote, peopleSearches } from "../../referrals/people";

describe("fillers", () => {
  it("counts um/uh and filler 'like' but not the verb", () => {
    const f = fillers("Um, so I like Python. It was, like, hard. Uh, you know, basically fine.");
    expect(f.total).toBe(5);
    expect(f.top[0]).toEqual(["um", 1]);
  });
});

describe("novelty", () => {
  it("is low for a trimmed version and high for invented content", () => {
    const a = "When the workstation went down nobody could chart for forty minutes and I want to be the person who shows up in ten";
    expect(novelty(a, "Nobody could chart for forty minutes when the workstation went down. I want to be the person who shows up in ten.")).toBeLessThan(0.1);
    expect(novelty(a, "I led a Kubernetes migration at Epic that cut downtime by ninety percent across twelve hospitals.")).toBeGreaterThan(0.5);
  });
});

describe("gradeAnswer", () => {
  const client = (json: unknown) => ({ messages: { create: async () => ({ content: [{ type: "text", text: JSON.stringify(json) }], usage: null, model: "claude-haiku-4-5" }) } }) as never;
  it("drops a stronger version that adds facts", async () => {
    const fb = await gradeAnswer({ question: "Why us?", answer: "Um I like the mission and the team seemed nice", role: "SWE Intern", profile: null }, client({ score: 5, keep: [], cut: [], tighten: [], stronger: "I shipped three Rust services at Stripe and led a team of eight engineers." }));
    expect(fb.stronger).toBe("");
    expect(fb.strongerDropped).toBe(true);
    expect(fb.fillers.total).toBe(1);
  });
});

describe("OA and referrals helpers", () => {
  it("rotates topics", () => { expect(pickTopic(["arrays and hashing"])).toBe("two pointers"); });
  it("drill schema clamps minutes", () => {
    expect(Drill.parse({ title: "t", prompt: "p", examples: [{ input: "1", output: "2" }], hints: ["h"], approach: "a", minutes: 5 }).minutes).toBe(10);
  });
  it("fits LinkedIn notes under 300 characters at a sentence end", () => {
    const long = "Hi Dana, I'm a NOVA IST student. ".repeat(12);
    const n = fitNote(long);
    expect(n.length).toBeLessThanOrEqual(300);
    expect(n.endsWith(".")).toBe(true);
  });
  it("builds searches, alumni first when the school is known", () => {
    const s = peopleSearches("Leidos", "IT Support Intern, Summer 2027", "Northern Virginia Community College");
    expect(s[0]!.relation).toBe("alum");
    expect(s[0]!.url).toContain("linkedin.com/search/results/people/?keywords=Northern%20Virginia");
    expect(s).toHaveLength(4);
  });
});
