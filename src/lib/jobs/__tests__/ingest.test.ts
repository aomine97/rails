import { describe, expect, it } from "vitest";
import { toJobRow } from "../ingest";

describe("toJobRow", () => {
  it("flattens pay and keeps identity keys", () => {
    const row = toJobRow("c1", {
      ats: "lever", companySlug: "appian", externalId: "x", title: "SWE", location: "McLean, VA", remote: false, employmentType: "Full-time", department: null,
      descriptionHtml: "<p>a</p>", descriptionText: "a", url: "u", applyUrl: "a", postedAt: null, pay: { min: 40, max: 48, currency: "USD", period: "hour" },
    }, "2026-09-19T00:00:00.000Z");
    expect(row).toMatchObject({ company_id: "c1", external_id: "x", pay_min: 40, pay_max: 48, pay_period: "hour", closed_at: null });
  });
});

import { pollCompany } from "../ingest";

/** Minimal fake of the supabase query builder covering what pollCompany uses. */
function fakeDb(existing: { id: string; external_id: string }[]) {
  const calls: { table: string; op: string; payload?: unknown }[] = [];
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    const chain = () => b;
    let op = ""; let payload: unknown;
    b.select = () => { if (!op) op = "select"; return b; };
    b.update = (p: unknown) => { op = "update"; payload = p; calls.push({ table, op, payload }); return b; };
    b.upsert = async (p: unknown) => { calls.push({ table, op: "upsert", payload: p }); return { error: null }; };
    b.eq = chain; b.is = chain; b.lt = chain; b.in = chain; b.not = chain; b.or = chain; b.order = chain; b.limit = chain;
    b.then = (res: (v: unknown) => void) => res(op === "select" && table === "jobs" ? { data: existing, error: null } : { data: [], error: null });
    return b;
  };
  return { from: builder, calls } as unknown as { from: (t: string) => unknown; calls: typeof calls };
}

describe("pollCompany", () => {
  it("inserts only unseen postings and touches the rest", async () => {
    const db = fakeDb([{ id: "row1", external_id: "old" }]);
    const fetchImpl = (async () => new Response(JSON.stringify([
      { id: "old", text: "Old job", hostedUrl: "u1", applyUrl: "a1", createdAt: 1, categories: {} },
      { id: "new", text: "New job", hostedUrl: "u2", applyUrl: "a2", createdAt: 2, categories: {} },
    ]), { status: 200 })) as unknown as typeof fetch;
    const r = await pollCompany(db as never, { id: "c1", name: "Acme", ats: "lever", slug: "acme", tenant: null, wdn: null, careers_url: null }, fetchImpl);
    expect(r).toMatchObject({ ok: true, listed: 2, inserted: 1, enriched: 0 });
    const upsert = db.calls.find((c) => c.op === "upsert")!;
    expect((upsert.payload as { external_id: string }[]).map((x) => x.external_id)).toEqual(["new"]);
    const touch = db.calls.find((c) => c.op === "update" && c.table === "jobs")!;
    expect(touch.payload).toMatchObject({ closed_at: null });
  });
});
