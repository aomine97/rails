# Rails extension (WXT, Manifest V3)

Side panel + on-demand autofill. Never submits, never uploads a file.

## Dev
    cd extension && npm install
    npm run build            # -> .output/chrome-mv3
    npm test                 # fill engine tests (jsdom)
    npm run zip              # -> .output/rails-extension-0.1.0-chrome.zip for the Web Store

Load unpacked: chrome://extensions -> Developer mode -> Load unpacked -> extension/.output/chrome-mv3

## Accounts (v1.6)
`lib/accounts.ts`: ATS accounts behave like a password manager. On a create-account form Rails fills the profile email and a 16-character generated password (both stored only in this browser's extension storage, keyed by tenant), shows the password in the drawer with Copy/Show, and leaves the terms box and the Create Account click to the user; on a sign-in form it fills the saved pair. "Create accounts for me" (off by default) also ticks the box and clicks; some employers' terms forbid automated account creation, so it is the user's choice. Passwords never reach Rails' servers. Email verification codes are pasted by the user.

## Workday (v1.7, selectors verified against a working automator)
Facts the adapter relies on, and why each one matters, are in ../WORKDAY.md. In short: fields live in
`div[data-automation-id="formField-<name>"]` with the label two or three levels above the control (so the label
reader climbs ancestors now); dropdown options render in a `position: fixed` portal and also answer to
type-ahead + Enter (both paths, short wait before the fallback); search prompts need Enter to search and Enter
to accept, and the result shows as a chip; dates are `dateSectionMonth-input` / `dateSectionYear-input` inside
the wrapper; education is `formField-{schoolItem,field-of-study,gradeAverage,firstYearAttended,lastYearAttended}`
plus `button[data-automation-id="degree"]`; rows are `workExperience-N` / `education-N` / `websitePanelSet-N`
added by `[data-automation-id*="add" i]`; steps are known from page markers (`contactInformationPage`,
`myExperiencePage`, `voluntaryDisclosuresPage`, `selfIdentificationPage`), not the progress bar; forward is
`bottom-navigation-next-button` or a button whose words are Save and Continue / Continue / Next. Advancing waits
for the page to actually change, surfaces Workday's validation errors as rows, and re-runs the fill on the new
step. `lib/workday-fixture.ts` builds a page that behaves this way so the tests catch a selector regression.

## Workday (v1.6 notes)
`lib/workday.ts` is one adapter for every tenant: Workday stamps controls with `data-automation-id` (legalNameSection_firstName, addressSection_countryRegion, phone-device-type, workExperienceSection/workExperience-N, educationSection/education-N, file-upload-input-ref, progressBar, bottom-navigation-next-button). Drivers: `wdListbox` (button[aria-haspopup=listbox] -> portal ul[role=listbox]), `wdSearch` (type-ahead selects: school, field of study, skills, phone country), `wdDate` (split month/year spinbuttons), `wdEnsureRows` (clicks Add / Add Another until the section has the rows the profile needs), radios, checkboxes. Steps: `wdStep()` reads the progress bar; the runner fills My Information, My Experience (work rows, education rows, skills, websites, resume), Voluntary Disclosures (saved answers only); Application Questions go through the generic scanner, which now sees listbox buttons. `watchSteps` notices SPA step changes; with "Fill every step" on, the drawer fills a step, clicks Workday's Save and Continue, reads back `errorMessage`s as ! rows, and stops before Review. Account creation and Submit are always the user's.

## How it works (v1.5: everything runs inside the tab)
The Jobright pattern. `rails.content.ts` mounts on the major ATS hosts (and `filler.js` is injected on any other site the user allows): a floating badge, an in-page drawer (`lib/drawer.ts`, shadow DOM) and the runner (`lib/runner.ts`). The drawer shows the job (auto-scored from the page's schema.org JobPosting when Rails has never seen it), the "Prepare your resume" step (keywords you confirm -> tailored resume -> preview -> use it or keep your upload), the Autofill button, the live checklist, and the "Did you submit?" prompt when you come back to the tab or click something that looks like Submit. Because the run lives in the page it keeps going when you switch tabs or close the side panel; a hidden tab throttles timers so it runs slower there, not stopped. Corrections you make by hand before submitting are remembered (`rails_answers`) for the next application. The side panel is now a mirror and launcher: its Autofill sends `rails:run` to the tab and it renders the `rails:state` the page broadcasts.

1. Side panel "Connect to Rails" opens https://rails-psi.vercel.app/ext/connect; that page mints a token and the `connect` content script stores it.
2. Panel calls /api/ext/me (profile fields), /api/ext/job?url= (fit, checklist, tailored resume for the tab's URL).
3. "Fill this page": first time on a site, Chrome asks to allow that origin (optional_host_permissions). The background injects `filler.js`, which maps fields by learned selector -> ATS selector -> autocomplete -> name/id -> label -> placeholder and sets values React-safely. An overlay tells the user to review and click the site's Submit.
4. Badge: `badge.content.ts` runs on the major ATS hosts (Greenhouse, Lever, Workday, iCIMS, Ashby, SmartRecruiters, Jobvite, Workable, BambooHR, Oracle, Taleo, SuccessFactors, ...) and shows a floating Rails tab bottom-right; click opens the side panel (`rails:open` -> `chrome.sidePanel.open`). The panel pushes the fit number to it (`rails:badge`) and caches fit per URL in `rails_fit_cache` so the tab shows the score before the panel opens. Those hosts need no permission prompt because content-script matches double as host permissions.
5. Checklist (v1.4, the Jobright pattern): `rails:scan-form` reads every question (label, kind, options, required, filled) into stable `data-rails-f` ids and opens up to 8 react-selects to list their options; the rule pass fills the known fields; saved answers (`rails_answers`, keyed by question text) fill recurring questions like pronouns/EEO/how-did-you-hear/terms without leaving the browser; the rest go to /api/ext/answers (Haiku, profile only, options enforced verbatim, EEO filtered by `NEVER`) and are applied one by one with live progress. Anything still open shows a dropdown of the page's options (or a text box) in the panel; picking fills the field, "Remember" saves it for next time.
6. Each fill posts one row per field to /api/ext/fill (fill_events); successes feed learned_selectors, which the next user on that domain gets first.
