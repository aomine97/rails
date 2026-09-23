import { describe, it, expect } from "vitest";
import { aliasOf, classifyEmail, makeAlias, matchApplication, nextStage, parseInbound } from "../classify";

describe("classifyEmail", () => {
  it.each([
    ["Thank you for applying to Leidos", "", "confirmation"],
    ["Your application", "Unfortunately, we have decided to move forward with other candidates.", "rejection"],
    ["Next steps", "Please complete the HackerRank assessment within 5 days.", "oa"],
    ["Interview request", "We'd like to schedule an interview. Share your availability for next week.", "interview"],
    ["Congratulations", "We are pleased to extend an offer for the role.", "offer"],
    ["Newsletter", "Check out our blog.", null],
  ])("%s", (subject, text, kind) => { expect(classifyEmail(subject, text)).toBe(kind); });
});

describe("nextStage", () => {
  it("moves forward only", () => {
    expect(nextStage("applied", "interview")).toBe("interview");
    expect(nextStage("interview", "oa")).toBeNull();
    expect(nextStage("interview", "confirmation")).toBeNull();
  });
  it("rejection lands anywhere before an offer", () => {
    expect(nextStage("oa", "rejection")).toBe("rejected");
    expect(nextStage("offer", "rejection")).toBeNull();
  });
});

describe("matchApplication", () => {
  const apps = [
    { id: "1", company_name: "Capital One", title: "Software Engineer Intern", last_activity_at: "2026-09-01" },
    { id: "2", company_name: "One Medical", title: "Data Analyst", last_activity_at: "2026-09-10" },
    { id: "3", company_name: "Leidos, Inc.", title: "IT Support Intern", last_activity_at: "2026-09-05" },
  ];
  it("prefers the longest company name in the text", () => {
    expect(matchApplication(apps, "no-reply@greenhouse.io", "Thank you for applying to Capital One", "")?.id).toBe("1");
  });
  it("matches by sender domain", () => {
    expect(matchApplication(apps, "Recruiting <jobs@leidos.com>", "Next steps", "")?.id).toBe("3");
  });
  it("returns null when nothing matches", () => {
    expect(matchApplication(apps, "a@b.com", "Hello", "nothing")).toBeNull();
  });
});

describe("parseInbound / aliases", () => {
  it("reads Postmark shape", () => {
    const r = parseInbound({ From: "x@y.com", To: "maya-4k2@in.rails.test", Subject: "Hi", TextBody: "Body  text" });
    expect(r).toEqual({ from: "x@y.com", to: ["maya-4k2@in.rails.test"], subject: "Hi", text: "Body text" });
  });
  it("finds the alias, ignoring +tags", () => {
    expect(aliasOf(["Maya <maya-4k2+gh@in.rails.test>"], "in.rails.test")).toBe("maya-4k2");
    expect(aliasOf(["someone@else.com"], "in.rails.test")).toBeNull();
  });
  it("makes an alias from the first name", () => {
    expect(makeAlias("Maya Rivera", () => 0)).toBe("maya-aaaa");
  });
});
