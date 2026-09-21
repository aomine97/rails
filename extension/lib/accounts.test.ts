// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { generatePassword, accountForm, tenantKey } from "./accounts";

describe("accounts", () => {
  it("passwords have every class an ATS asks for and never repeat", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) { const p = generatePassword(); expect(p).toHaveLength(16); expect(p).toMatch(/[A-Z]/); expect(p).toMatch(/[a-z]/); expect(p).toMatch(/[0-9]/); expect(p).toMatch(/[!@#$%&*?]/); seen.add(p); }
    expect(seen.size).toBe(50);
  });
  it("one account per tenant", () => { expect(tenantKey("nvidia.wd5.myworkdayjobs.com")).toBe("nvidia"); expect(tenantKey("careers-amd.icims.com")).toBe("careers-amd"); });
  it("finds Workday's create-account form and a generic sign-in form", () => {
    document.body.innerHTML = `<div data-automation-id="email"><input type="text"></div><div data-automation-id="password"><input type="password"></div><div data-automation-id="verifyPassword"><input type="password"></div><div data-automation-id="createAccountCheckbox"><input type="checkbox"></div><button data-automation-id="createAccountSubmitButton">Create Account</button>`;
    const f = accountForm(); expect(f.mode).toBe("create"); expect(f.verify).not.toBeNull(); expect(f.terms).not.toBeNull(); expect(f.submit?.textContent).toBe("Create Account");
    document.body.innerHTML = `<form><input type="email" name="email"><input type="password" name="pw"><button type="submit">Sign in</button></form>`;
    const g = accountForm(); expect(g.mode).toBe("signin"); expect(g.verify).toBeNull(); expect(g.email?.name).toBe("email");
    document.body.innerHTML = `<input id="first_name">`; expect(accountForm().mode).toBeNull();
  });
});
