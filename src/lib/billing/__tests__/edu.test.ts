import { describe, expect, it } from "vitest";
import { isAcademicEmail } from "../edu";
import { productFor, semesterEnd } from "../stripe";

describe("isAcademicEmail", () => {
  it("accepts .edu and academic country suffixes", () => {
    expect(isAcademicEmail("pn@email.vccs.edu")).toBe(true);
    expect(isAcademicEmail("a@gmu.edu")).toBe(true);
    expect(isAcademicEmail("a@cam.ac.uk")).toBe(true);
    expect(isAcademicEmail("a@unam.edu.mx")).toBe(true);
  });
  it("rejects everything else", () => {
    expect(isAcademicEmail("a@gmail.com")).toBe(false);
    expect(isAcademicEmail("a@edu.com")).toBe(false);
    expect(isAcademicEmail("a@notedu.education")).toBe(false);
    expect(isAcademicEmail("")).toBe(false);
    expect(isAcademicEmail(null)).toBe(false);
  });
});

describe("products", () => {
  it("maps plan + student to the right product", () => {
    expect(productFor("pro", true)).toBe("pro_monthly_student");
    expect(productFor("pro", false)).toBe("pro_monthly");
    expect(productFor("semester", true)).toBe("semester_student");
    expect(productFor("semester", false)).toBe("semester");
  });
  it("semester pass runs 4 months", () => {
    expect(semesterEnd(new Date("2026-09-20T00:00:00Z")).toISOString().slice(0, 10)).toBe("2027-01-20");
  });
});
