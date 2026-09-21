# Workday: what was wrong, and the plan

Written 2026-09-21 after comparing our adapter against a working Workday automator
(github.com/ubangura/Workday-Application-Automator, archived but its selectors are real) and the
Vanguard run. Everything below is a verified fact about Workday's DOM or a decision that follows from one.

## What Workday actually looks like

1. Every field sits in a wrapper: `div[data-automation-id="formField-<name>"]`, with the `<label>` inside
   that wrapper and the control (input / button / textarea) nested deeper. **The label is two or three
   ancestors up from the input, not one.**
2. A dropdown is `button[data-automation-id="<name>"]`. Its options render in a portal as
   `li[data-automation-id="promptOption"]` / `[role="option"]` inside `[data-automation-id="activeListContainer"]`.
   A portal is `position: fixed`, so `offsetParent` is null there — any visibility filter using it throws
   every option away.
3. A searchable prompt (school, field of study, skills, phone country code) is an `input` inside its
   formField wrapper. It needs **Enter to search, then Enter again to accept** the first result. The chosen
   value then lives in a chip (`selectedItem`), not in the input.
4. Dates are two spinbuttons inside the wrapper: `input[data-automation-id="dateSectionMonth-input"]` and
   `...Year-input`. **The prefix is on the wrapper (`formField-startDate`), not on the input id.**
5. Repeating sections: `div[data-automation-id="workExperience-N"]`, `education-N`, `websitePanelSet-N`,
   each added by a button matching `[data-automation-id*="add" i]` inside the section.
6. Each step has a page marker: `contactInformationPage`, `myExperiencePage`, `voluntaryDisclosuresPage`,
   `selfIdentificationPage`. These are reliable; the progress bar is not.
7. The forward button is `button[data-automation-id="bottom-navigation-next-button"]`.
8. Education fields are `formField-schoolItem`, `formField-field-of-study`, `formField-gradeAverage`,
   `formField-firstYearAttended`, `formField-lastYearAttended`, and degree is `button[data-automation-id="degree"]`.

## Why ours failed

| Symptom | Cause |
| --- | --- |
| Most of My Information left blank | Education/date/website ids were invented (`school`, `gpa`, `startDate-dateSectionMonth-input`) instead of the wrapper pattern |
| Questions page filled 5/17 | The generic label reader climbed one ancestor, so Workday's labels (two levels up, in the formField wrapper) came back empty and the fields were never identified |
| Dropdowns "not working" | Options live in a fixed-position portal; picks were also attempted while a previous list was still open |
| Search selects reported empty after picking | The value is in a chip, and they need a second Enter to accept |
| Won't advance | The Save-and-Continue button only rendered when the progress bar parsed into a known step; when it read "unknown" the button never appeared |

## The plan

1. **Label reading**: climb up to 4 ancestors, prefer the `formField-*` wrapper's own `<label>`. This alone
   fixes the generic path on every Workday page and helps every other ATS.
2. **One widget driver per widget type**, each verifying its own result:
   - listbox button: close stale lists → click → pick the option if it is in the DOM → else type-ahead + Enter → verify the button's text changed off "Select One".
   - search prompt: fill → Enter → wait → Enter → verify a chip appeared.
   - date: find the wrapper, then the month/year spinbuttons inside it, type digits.
   - repeaters: click add until N rows exist, fill row by row.
3. **Step detection from page markers**, progress bar only as a fallback, and `unknown` never blocks the UI.
4. **Advance**: the Save-and-Continue button shows whenever Workday's next button exists. After clicking,
   wait for the page marker to change; if validation errors appear instead, show them as rows and re-run
   the fill for those fields.
5. **Self-identify and Submit stay the user's.** Account creation stays opt-in.
6. **Tests**: a jsdom fixture that behaves like Workday (portal options, type-ahead + Enter, two-Enter
   prompts, formField wrappers, add-another rows) so these regressions are caught without a live tenant.
