# Real-browser tests for the fill engine

jsdom cannot reproduce the things that actually break Workday autofill: `offsetParent` is always null there
(so fixed-position portal options look invisible), portals, focus and key handling are approximations, and a
layout engine does not exist. Every bug that reached Ilyas passed the jsdom suite first. These tests run the
real engine in real Chromium against pages built to Workday's DOM contract.

    npm run e2e         # needs a Chromium; set PW_CHROMIUM to point at one

`pages/` holds fixtures modelled on the Vanguard application (the one we have a full field list for):
`info.html` is My Information, `questions.html` is the 17-question compliance page. `wd.js` implements the
widgets the way Workday does — formField wrappers with the label above the control, dropdowns whose options
render in a `position: fixed` portal appended to `<body>`, search prompts that need Enter to search and Enter
to accept and keep the pick in a chip, radio and checkbox groups whose own option labels are not the question.

A fixture is not the live site: it cannot catch server-side search, session expiry, or the page advancing.
It does catch selector rot, label misreads, and widget-driving regressions, which is what has been failing.
