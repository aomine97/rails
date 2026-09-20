import { describe, expect, it } from "vitest";
import { SignupInput, fieldErrors, isEdu } from "../validate";
import { isGated } from "../../geo";

describe("signup validation", () => {
  it("accepts a NOVA student", () => {
    const r = SignupInput.safeParse({ fullName: "Maya Patel", email: "MP@email.vccs.edu", password: "longenough1", state: "VA" });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.email).toBe("mp@email.vccs.edu"); expect(isEdu(r.data.email)).toBe(true); }
  });
  it("reports one message per field", () => {
    const r = SignupInput.safeParse({ fullName: "M", email: "nope", password: "short", state: "ZZ" });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(fieldErrors(r.error)).sort()).toEqual(["email", "fullName", "password", "state"]);
  });
  it("gates CA and NY only", () => {
    expect(isGated("CA")).toBe(true); expect(isGated("ny")).toBe(true); expect(isGated("VA")).toBe(false); expect(isGated(null)).toBe(false);
  });
});
