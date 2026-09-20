# Rails extension (WXT, Manifest V3)

Side panel + on-demand autofill. Never submits, never uploads a file.

## Dev
    cd extension && npm install
    npm run build            # -> .output/chrome-mv3
    npm test                 # fill engine tests (jsdom)
    npm run zip              # -> .output/rails-extension-0.1.0-chrome.zip for the Web Store

Load unpacked: chrome://extensions -> Developer mode -> Load unpacked -> extension/.output/chrome-mv3

## How it works
1. Side panel "Connect to Rails" opens https://rails-psi.vercel.app/ext/connect; that page mints a token and the `connect` content script stores it.
2. Panel calls /api/ext/me (profile fields), /api/ext/job?url= (fit, checklist, tailored resume for the tab's URL).
3. "Fill this page": first time on a site, Chrome asks to allow that origin (optional_host_permissions). The background injects `filler.js`, which maps fields by learned selector -> ATS selector -> autocomplete -> name/id -> label -> placeholder and sets values React-safely. An overlay tells the user to review and click the site's Submit.
4. Each fill posts one row per field to /api/ext/fill (fill_events); successes feed learned_selectors, which the next user on that domain gets first.
