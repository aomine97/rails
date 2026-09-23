import { describe, it, expect } from "vitest";
import { costUsd } from "../usage";
import { trimDescription } from "../../jobs/tagger";
import { triageTitles } from "../../jobs/triage";

describe("costUsd", () => {
  it("prices haiku and sonnet per million tokens, dated ids included", () => {
    expect(costUsd("claude-haiku-4-5", { input_tokens: 1_000_000, output_tokens: 0 })).toBeCloseTo(1);
    expect(costUsd("claude-sonnet-4-5-20250929", { input_tokens: 0, output_tokens: 1_000_000 })).toBeCloseTo(15);
  });
  it("halves batch and bills cache reads at a tenth", () => {
    expect(costUsd("claude-haiku-4-5", { input_tokens: 2_000_000 }, true)).toBeCloseTo(1);
    expect(costUsd("claude-haiku-4-5", { cache_read_input_tokens: 1_000_000 })).toBeCloseTo(0.1);
    expect(costUsd("claude-haiku-4-5", null)).toBe(0);
  });
});

describe("trimDescription", () => {
  it("drops EEO and benefits paragraphs but keeps pay", () => {
    const text = ["Build data pipelines in Python and SQL.", "We are an equal opportunity employer and value diversity.", "Benefits include 401k and PTO.", "Pay range: $30 to $40 an hour. Benefits apply."].join("\n\n");
    const out = trimDescription(text);
    expect(out).toContain("Python and SQL");
    expect(out).not.toContain("equal opportunity");
    expect(out).not.toContain("401k and PTO.");
    expect(out).toContain("$30");
  });
  it("caps length", () => { expect(trimDescription("a".repeat(20_000), 7000).length).toBeLessThanOrEqual(7000); });
});

describe("triageTitles", () => {
  const client = (text: string) => ({ messages: { create: async () => ({ content: [{ type: "text", text }], usage: null, model: "claude-haiku-4-5" }) } }) as never;
  const items = [{ id: "a", title: "Software Engineer Intern" }, { id: "b", title: "Retail Sales Associate" }, { id: "c", title: "Registered Nurse, New Grad" }];
  it("maps the numbered yes list back to ids", async () => {
    const yes = await triageTitles(items, client('{"yes":[1,3]}'));
    expect([...yes].sort()).toEqual(["a", "c"]);
  });
  it("ignores out-of-range numbers", async () => {
    expect([...(await triageTitles(items, client('{"yes":[0,4,2]}')))]).toEqual(["b"]);
  });
  it("throws on unreadable output so the batch stays untriaged", async () => {
    await expect(triageTitles(items, client("sorry"))).rejects.toThrow();
  });
});
