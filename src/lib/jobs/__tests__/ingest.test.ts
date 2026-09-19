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
