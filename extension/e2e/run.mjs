/* Drives the fill engine in real Chromium against the Workday-shaped fixtures and asserts the result.
   Exits non-zero on any failure so it can gate a commit. */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const bundlePath = join(here, ".bundle.js");
execFileSync("npx", ["esbuild", join(here, "entry.ts"), "--bundle", "--format=iife", `--outfile=${bundlePath}`, "--platform=browser", "--log-level=error"], { stdio: "inherit" });
const bundle = readFileSync(bundlePath, "utf8");

/** A Chromium this machine already has: PW_CHROMIUM, Playwright's own download, or the container's. */
function chromiumPath() {
  const candidates = [process.env.PW_CHROMIUM, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);
  return candidates.find((p) => existsSync(p));
}

const me = {
  name: "Pranav Nepal", email: "navavinga@gmail.com", plan: "free", credits: 1,
  skills: ["Python", "TypeScript", "AWS"],
  fields: {
    firstName: "Pranav", lastName: "Nepal", fullName: "Pranav Nepal", preferredName: null,
    email: "navavinga@gmail.com", phone: "(571) 355-7626", phoneCountry: "United States",
    street: "1 Main St", city: "Leesburg", state: "VA", stateName: "Virginia", zip: "20175", country: "United States",
    linkedin: "linkedin.com/in/pranavnepal", github: "github.com/aomine97", portfolio: null,
    school: "Northern Virginia Community College", degree: "AAS", degreeName: "Associate's Degree",
    major: "Information Systems Technology", disciplines: ["Information Technology"],
    startYear: "2025", gradYear: "2027", gradMonth: "May", gradDate: "May 2027", gpa: null,
    workAuthorized: true, needsSponsorship: false,
  },
  experience: [{ title: "Machine Learning Intern", org: "Stealth AI Startup", kind: "internship", start: "2026-06", end: "2026-08", current: false, bullets: ["Built data pipelines."] }],
  education: [{ school: "Northern Virginia Community College", degree: "AAS", degreeName: "Associate's Degree", field: "Information Systems Technology", startYear: 2025, gradYear: 2027, gpa: null }],
};

let failures = 0;
const ok = (cond, what, detail = "") => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${what}${detail && !cond ? ` — ${detail}` : ""}`); if (!cond) failures++; };

const exe = chromiumPath();
if (!exe) { console.error("No Chromium found. Set PW_CHROMIUM=/path/to/chrome, or run `npx playwright install chromium`."); process.exit(2); }
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

async function load(file) {
  await page.goto(pathToFileURL(join(here, "pages", file)).href);
  await page.addScriptTag({ content: bundle });
  await page.waitForFunction(() => !!window.Rails);
}

console.log("\nMy Information (Vanguard shape)");
await load("info.html");
const info = await page.evaluate(async (me) => {
  const R = window.Rails;
  const report = await R.wdFillInfo(me, {});
  const read = (id) => { const el = document.querySelector(`[data-automation-id="${id}"]`); return !el ? null : el.tagName === "INPUT" ? el.value : el.textContent.trim(); };
  const chip = (field) => document.querySelector(`[data-automation-id="formField-${field}"] [data-automation-id="selectedItem"]`)?.textContent ?? "";
  return {
    report,
    v: {
      source: chip("sourceSection"),
      previousWorker: [...document.querySelectorAll('[data-automation-id="previousWorker"] input')].find((r) => r.checked)?.value ?? "",
      country: read("countryDropdown"), first: read("legalNameSection_firstName"), last: read("legalNameSection_lastName"),
      street: read("addressSection_addressLine1"), city: read("addressSection_city"), state: read("addressSection_countryRegion"),
      zip: read("addressSection_postalCode"), email: read("email"), phoneType: read("phone-device-type"),
      phoneCode: chip("countryPhoneCode"), phone: read("phone-number"),
    },
    scan: R.scanFields(document).map((f) => ({ label: f.label, kind: f.kind, filled: f.filled })),
  };
}, me);
const v = info.v;
ok(v.first === "Pranav" && v.last === "Nepal", "legal name");
ok(v.street === "1 Main St" && v.city === "Leesburg" && v.zip === "20175", "address");
ok(v.state === "Virginia", "state dropdown (portal list)", `got ${JSON.stringify(v.state)}`);
ok(v.country === "United States of America", "country left as prefilled");
ok(v.phoneType === "Mobile", "phone device type", `got ${JSON.stringify(v.phoneType)}`);
ok(/\+1/.test(v.phoneCode), "phone country code chip", `got ${JSON.stringify(v.phoneCode)}`);
ok(v.phone === "5713557626", "phone number digits only", `got ${JSON.stringify(v.phone)}`);
ok(v.email === "navavinga@gmail.com", "prefilled email untouched");
ok(!!v.source, "how did you hear (search prompt) picked something", "left empty");
ok(v.previousWorker === "No", "previously worked here = No", `got ${JSON.stringify(v.previousWorker)}`);
ok(info.report.every((r) => r.success), "every reported field succeeded", info.report.filter((r) => !r.success).map((r) => r.key).join(", "));
const radio = info.scan.find((f) => f.kind === "radio");
ok(!!radio && /worked for or with Vanguard/i.test(radio.label), "radio group is labelled with its question, not its first option", `got ${JSON.stringify(radio?.label?.slice(0, 40))}`);
ok(info.scan.every((f) => f.label), "every scanned field has a label");

console.log("\nApplication Questions (17 compliance questions)");
await load("questions.html");
const q = await page.evaluate(async () => {
  const R = window.Rails;
  const fields = R.scanFields(document);
  const results = [];
  for (const f of fields) {
    if (f.kind === "text" || f.kind === "textarea") { results.push({ label: f.label, kind: f.kind, skipped: true }); continue; }
    const want = f.kind === "checkboxes" ? ["No", "None"].filter((x) => (f.options ?? []).includes(x)) : "No";
    let okd = false, err = null;
    try { okd = await R.applyAnswer(document, f, want); } catch (e) { err = String(e.message); }
    results.push({ label: f.label, kind: f.kind, ok: okd, err });
  }
  return { results, count: fields.length, noLabel: fields.filter((f) => !f.label).length, filledAfter: R.scanFields(document).filter((f) => f.filled).length };
});
ok(q.count === 17, "all 17 questions are seen", `saw ${q.count}`);
ok(q.noLabel === 0, "no question is unlabelled", `${q.noLabel} unlabelled`);
const longOnes = q.results.filter((r) => r.label.length > 300);
ok(longOnes.length >= 1, "a question longer than 300 characters is not dropped", `longest seen: ${Math.max(...q.results.map((r) => r.label.length))}`);
const cbs = q.results.filter((r) => r.kind === "checkboxes");
ok(cbs.every((r) => r.label.length > 20), "checkbox groups are labelled with the question, not the first option", cbs.map((r) => r.label.slice(0, 25)).join(" | "));
const answerable = q.results.filter((r) => !r.skipped);
ok(answerable.every((r) => r.ok), "every answerable question took its answer", answerable.filter((r) => !r.ok).map((r) => `${r.label.slice(0, 30)}${r.err ? " " + r.err : ""}`).join(" | "));
ok(q.filledAfter >= 16, "at least 16 of 17 show as filled afterwards", `${q.filledAfter} filled`);

ok(pageErrors.length === 0, "no page errors", pageErrors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} failing check${failures > 1 ? "s" : ""}\n` : "\nAll checks passed\n");
process.exit(failures ? 1 : 0);
