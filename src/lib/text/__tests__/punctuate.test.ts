import { describe, expect, it } from "vitest";
import { bullet, sentence, title, paragraph, tidyLine } from "../punctuate";

describe("punctuate", () => {
  it("bullets end with one period, start capitalized, lose glyphs and stray spaces", () => {
    expect(bullet("• resolved 300 tickets in ServiceNow ,cut backlog 40%")).toBe("Resolved 300 tickets in ServiceNow, cut backlog 40%.");
    expect(bullet("Imaged lab machines..")).toBe("Imaged lab machines.");
    expect(bullet("Built a CLI (Python)")).toBe("Built a CLI (Python).");
    expect(bullet("   ")).toBe("");
  });
  it("titles never end with a period", () => { expect(title("Cloud-focused IT student.")).toBe("Cloud-focused IT student"); });
  it("paragraphs get a period per sentence", () => { expect(paragraph("i build tools. they ship fast")).toBe("I build tools. They ship fast."); });
  it("tidyLine fixes spacing around punctuation", () => { expect(tidyLine("Python ,SQL , AWS")).toBe("Python, SQL, AWS"); expect(sentence("done!")).toBe("Done!"); });
});
