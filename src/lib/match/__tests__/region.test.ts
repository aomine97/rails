import { describe, expect, it } from "vitest";
import { regionOf } from "../region";

describe("regionOf", () => {
  it("classifies", () => {
    expect(regionOf("McLean, VA")).toBe("dmv");
    expect(regionOf("US - Ashburn, VA")).toBe("dmv");
    expect(regionOf("Hong Kong")).toBe("intl");
    expect(regionOf("Remote - India")).toBe("intl");
    expect(regionOf("Remote")).toBe("remote");
    expect(regionOf("San Francisco, CA")).toBe("us");
    expect(regionOf("Bangalore, KA, India")).toBe("intl");
    expect(regionOf("Toronto, ON")).toBe("intl");
    expect(regionOf(null)).toBe("unknown");
    expect(regionOf("Anywhere", "REMOTE")).toBe("remote");
    expect(regionOf("Somewhere", "GB")).toBe("intl");
  });
});
