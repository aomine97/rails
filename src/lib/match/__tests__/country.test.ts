import { describe, expect, it } from "vitest";
import { countryOf, currencyFor, formatPay } from "../country";

describe("countryOf", () => {
  it("prefers the tagged country, else reads the location", () => {
    expect(countryOf("Toronto, ON", "CA")).toBe("CA");
    expect(countryOf("Toronto, ON", "unknown")).toBe("CA");
    expect(countryOf("London, United Kingdom")).toBe("GB");
    expect(countryOf("Bengaluru, Karnataka, India")).toBe("IN");
    expect(countryOf("Reston, VA")).toBe("US");
    expect(countryOf("Remote")).toBe("REMOTE");
    expect(countryOf("")).toBe("unknown");
  });
  it("US hints win over foreign-looking words", () => {
    expect(countryOf("Paris, TX")).toBe("US");
    expect(countryOf("New Delhi, DE")).toBe("US"); // DE = Delaware in a US-style string
  });
});

describe("pay formatting", () => {
  it("uses the country's currency unless the row says otherwise", () => {
    expect(currencyFor("GB")).toBe("GBP"); expect(currencyFor("GB", "usd")).toBe("USD"); expect(currencyFor("XX")).toBe("USD");
    expect(formatPay(25, 32, "USD", "hour")).toBe("$25 - $32/hr");
    expect(formatPay(45000, 55000, "GBP", "year")).toBe("£45k - £55k");
    expect(formatPay(800000, 1200000, "INR", "year")).toBe("₹8L - ₹12L");
    expect(formatPay(30, null, "CAD", "hour")).toBe("C$30/hr");
    expect(formatPay(null, null, "USD", "hour")).toBeNull();
  });
});
