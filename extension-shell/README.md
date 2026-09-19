# Rails extension: shell build for Chrome Web Store review

Purpose: get a listing into review now (3-6 weeks) so the real build in week 3 is an update, not a first submission.

Upload:
1. `cd extension-shell && zip -r ../rails-extension-shell.zip . -x "README.md"`
2. Chrome Web Store developer dashboard ($5 one-time) -> New item -> upload the zip.
3. Store listing: name "Rails: autofill job applications", category Productivity, 1280x800 screenshot of the side panel, privacy: "does not collect data" for this shell.
4. Visibility: Unlisted until the real build ships.
