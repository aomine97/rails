import { mountRails } from "../lib/inpage";

/** Rails inside the page on the major ATS hosts: badge, drawer, autofill runner. Other hosts get the same code injected after the user allows the site. */
const ATS_HOSTS = [
  "*://*.greenhouse.io/*", "*://*.lever.co/*", "*://*.myworkdayjobs.com/*", "*://*.myworkdaysite.com/*", "*://*.icims.com/*", "*://*.ashbyhq.com/*",
  "*://*.smartrecruiters.com/*", "*://*.jobvite.com/*", "*://*.workable.com/*", "*://*.bamboohr.com/*", "*://*.oraclecloud.com/*", "*://*.taleo.net/*",
  "*://*.successfactors.com/*", "*://*.successfactors.eu/*", "*://*.applytojob.com/*", "*://*.breezy.hr/*", "*://*.rippling.com/*", "*://*.dover.com/*",
  "*://*.recruitee.com/*", "*://*.ultipro.com/*", "*://*.paylocity.com/*", "*://*.adp.com/*", "*://*.eightfold.ai/*", "*://*.phenom.com/*", "*://*.usajobs.gov/*",
];
export default defineContentScript({ matches: ATS_HOSTS, runAt: "document_idle", main() { mountRails(); } });
