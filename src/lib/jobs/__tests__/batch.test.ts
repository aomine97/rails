import { describe, expect, it, vi } from "vitest";
import { parseTagText, tagRequest } from "../tagger";
import { submitTagBatch, collectTagBatches } from "../batch";

const SAMPLE = `{"level":"Internship","field":"software","requiredSkills":["Python",{"name":"SQL"}],"preferredSkills":["python","AWS"],"requirements":[{"text":"Pursuing a CS degree","required":true}],"minDegree":"bachelors","yearsMin":0,"clearanceRequired":"None","usCitizenRequired":false,"sponsorship":"No","remote":"Hybrid","employmentType":"internship","payMinHourly":30,"payMaxHourly":40,"hasOnlineAssessment":true,"summary":"Build data pipelines.","relocationOffered":null,"country":"US"}`;

describe("tagger shared pieces", () => {
  it("tagRequest carries the posting and asks for every key", () => {
    const r = tagRequest({ title: "SWE Intern", company: "Acme", location: "Reston, VA", descriptionText: "x".repeat(20_000) });
    const content = String(r.messages[0].content);
    expect(content).toContain("Title: SWE Intern");
    expect(content.length).toBeLessThan(13_000);
    expect(content).toContain("requiredSkills");
    expect(r.max_tokens).toBe(1500);
  });
  it("parseTagText normalizes enums, dedupes skills, drops preferred that are required", () => {
    const t = parseTagText("Here you go:\n" + SAMPLE + "\nDone.");
    expect(t.level).toBe("internship"); expect(t.sponsorship).toBe("no"); expect(t.remote).toBe("hybrid");
    expect(t.requiredSkills).toEqual(["python", "sql"]);
    expect(t.preferredSkills).toEqual(["aws"]);
    expect(t.clearanceRequired).toBe("none");
  });
});

/** Minimal fake of the supabase query builder: enough for the two functions under test. */
function fakeDb(rows: Record<string, unknown[]>, log: string[]) {
  const q = (table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const m of ["select", "is", "not", "neq", "eq", "order", "limit", "in"]) chain[m] = self;
    chain.update = (patch: unknown) => { log.push(`update ${table} ${JSON.stringify(patch)}`); return chain; };
    chain.upsert = (rowsIn: unknown[]) => { log.push(`upsert ${table} ${rowsIn.length}`); return Promise.resolve({ data: null, error: null }); };
    chain.insert = (row: unknown) => { log.push(`insert ${table} ${JSON.stringify(row)}`); return Promise.resolve({ data: null, error: null }); };
    chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: rows[table] ?? [], error: null }).then(res);
    return chain;
  };
  return { from: q } as never;
}

describe("submitTagBatch", () => {
  it("submits one request per job with custom_id = job id and marks them", async () => {
    const log: string[] = [];
    const db = fakeDb({ jobs: [{ id: "j1", title: "A", location: null, description_text: "desc", companies: { name: "Co" } }, { id: "j2", title: "B", location: "X", description_text: "desc2", companies: null }] }, log);
    const create = vi.fn(async ({ requests }: { requests: { custom_id: string }[] }) => ({ id: "msgbatch_1", processing_status: "in_progress", n: requests.length }));
    const client = { messages: { batches: { create } } } as never;
    const r = await submitTagBatch(db, 100, client);
    expect(r).toEqual({ submitted: 2, batchId: "msgbatch_1" });
    expect(create.mock.calls[0][0].requests.map((x) => x.custom_id)).toEqual(["j1", "j2"]);
    expect(log.some((l) => l.startsWith("insert tag_batches"))).toBe(true);
    expect(log.some((l) => l.includes('"tag_batch_id":"msgbatch_1"'))).toBe(true);
  });
  it("does nothing when there is nothing to tag", async () => {
    const create = vi.fn();
    const r = await submitTagBatch(fakeDb({ jobs: [] }, []), 100, { messages: { batches: { create } } } as never);
    expect(r.submitted).toBe(0); expect(create).not.toHaveBeenCalled();
  });
});

describe("collectTagBatches", () => {
  it("applies succeeded results, releases failed ones, marks batch done", async () => {
    const log: string[] = [];
    const db = fakeDb({ tag_batches: [{ id: "msgbatch_1", status: "in_progress", tagged: 0, failed: 0 }], jobs: [{ id: "j1" }, { id: "j2" }, { id: "j3" }] }, log);
    async function* results() {
      yield { custom_id: "j1", result: { type: "succeeded", message: { content: [{ type: "text", text: SAMPLE }] } } };
      yield { custom_id: "j2", result: { type: "errored" } };
      yield { custom_id: "j9", result: { type: "succeeded", message: { content: [{ type: "text", text: SAMPLE }] } } }; // not pending: skipped
    }
    const client = { messages: { batches: { retrieve: async () => ({ processing_status: "ended" }), results: async () => results() } } } as never;
    const out = await collectTagBatches(db, 60_000, client);
    expect(out[0]).toMatchObject({ id: "msgbatch_1", status: "done", tagged: 1, failed: 1, done: true });
    expect(log.filter((l) => l.includes('"tagged_at"')).length).toBe(1);
    expect(log.some((l) => l.includes('"tag_batch_id":null'))).toBe(true);
  });
  it("leaves a still-processing batch alone", async () => {
    const db = fakeDb({ tag_batches: [{ id: "msgbatch_2", status: "in_progress", tagged: 0, failed: 0 }] }, []);
    const client = { messages: { batches: { retrieve: async () => ({ processing_status: "in_progress" }), results: vi.fn() } } } as never;
    const out = await collectTagBatches(db, 60_000, client);
    expect(out[0].done).toBe(false);
  });
});
