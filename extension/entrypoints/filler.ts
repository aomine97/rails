import { mountRails } from "../lib/inpage";

/** Unlisted script, injected on demand (scripting.executeScript) after the user grants a site that is not a known ATS host. Same code as the content script. */
export default defineUnlistedScript(() => { mountRails(); });
