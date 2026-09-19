# RESEARCH.md — Pre-mortem (2026-09-18)

Five parallel research streams, ~400 searches/fetches. Evidence vs. inference is marked. Competitor-blog sources are flagged (†).
Read this before touching PLAN.md. The original plan ("Jobright for all careers, NOVA all majors, $14.99/mo, 4-week launch with extension") fails on four independent grounds. What survives is narrower.

## VERDICT

1. As scoped, this is likely a small business at best and a failed launch at worst. The four independent failures:
   - Beachhead collapse: NOVA is adopting Handshake collegewide Fall 2026 — a free, school-endorsed job board with AI matching and resume help arriving at our launch campus in our launch month.
   - Feature commoditization: LinkedIn Premium Apply Assistant (June 2026) autofills on third-party sites; Indeed Career Scout covers hourly/non-tech; Simplify and JobWizard autofill for free.
   - Wrong pain for the segment: the "brutal market" is a CS/four-year story (CS 7.0% unemployment, 273 apps/posting). NOVA's biggest programs — nursing 2.1%, education ~1% — hire in cohorts. Hourly/retail hiring uses sub-5-minute mobile flows where autofill has little to fill. Most CC students are working adults doing incremental searches, not graduation launches.
   - Timeline: Chrome Web Store review is 3–6 weeks in 2026 for `<all_urls>` extensions from a new developer account. A 4-week launch with the extension is not possible.
2. What is real: causal evidence that writing assistance raises hires (+8%, NBER w30886), strongest for weaker writers; no CC-specific tool exists; NOVA IT/business transfer-bound students face the same 7% market as four-year CS peers; Jobright proves the category monetizes ($7M ARR, 405% growth) — for tech job seekers at $30+/mo.
3. Best-supported reshaping: narrow wedge (NOVA/GMU-bound IT and business students — the founder's own peers), web-first launch without the extension, tailoring-quality as the core value with a hard no-fabrication rule, semester-pass pricing instead of monthly, ATS public feeds only (no paid aggregator), geo-gate CA/NY, founder-face short video as the single channel. See "Plan changes."

## 1. Competition

- Jobright: $3.2M seed (Translink, Indeed's venture arm), $5M ARR Feb 2026 → $7M ARR Jun 2026, 2M users, 9 people. Matching + resume + autofill + agent. https://www.arr.club/jobright/jobright-arr-hit-7m-with-fewer-than-10-employees-and-2m-job-seekers-globally
- Simplify: YC W21, $3M seed, 1M+ installs, free autofill. https://techcrunch.com/2024/02/07/simplify-looks-to-ai-to-help-with-job-searches-and-applications
- Teal: $19M raised, 4M users, acquired Ramped (auto-apply) Dec 2025. https://www.businesswire.com/news/home/20251211855070/en/
- Sonara: shut down Feb 2024 (couldn't raise; "poor job matching accuracy and frequent application failures"). The canonical failure. https://www.jobboardsecrets.com/2025/07/21/bolds-ascendancy-in-the-online-recruitment-ecosystem/
- LazyApply: Trustpilot 2.1/5. LoopCV: "matched 1800+ jobs, applied to 0." JobWizard: free autofill for Workday/Greenhouse/500+ sites on Chrome Store.
- No standalone consumer job-search subscription verified above ~$20–30M ARR. Largest disclosed: Jobright $7M. Proven >$30M consumer models are resume-builder trial funnels (BOLD) and LinkedIn Premium, not AI matching.
- LinkedIn Premium Apply Assistant (rolling out June 24 2026) pre-fills fields and drafts cover letters, "will even work for roles not advertised on LinkedIn." First incumbent cross-site autofill. https://www.hrdive.com/news/sociable-linkedin-automates-job-application-process-for-premium-users/823876/
- Indeed Career Scout (Sept 2025): pre-fills applications, tailors resumes, tracks — inside Indeed. Indeed dominates hourly/non-tech. https://www.indeed.com/news/releases/indeed-introduces-new-suite-of-hiring-products-career-scout-talent-scout-premium-sponsored-jobs-and-indeed-connect
- Handshake: NOVA "collegewide adoption Fall 2026." https://www.nvcc.edu/student-resources/career-services/handshake.html — AI job assistant, conversational search, Sidekick resume editor, AI-ranked feed; no autofill yet. MSA has no exclusivity clause on career centers recommending other tools. https://joinhandshake.com/legal/msa/
- Greenhouse: 244–254 applications/job (+111% since 2022), CEO calls $20 mass-apply tools a "doom loop," adding friction. https://fortune.com/2026/07/27/greenhouse-ceo-daniel-chait-ai-doom-loop-job-seekers-spam-interview-applications-unemployment/
- Nobody targets CC/hourly/trades with candidate SaaS. Inference: the gap exists because that hiring doesn't run through long ATS forms.

## 2. Platform and legal

- Chrome Web Store: single-purpose policy; remote JS banned (remote JSON config OK); "don't allow extensions that send messages on behalf of the user without giving the user the ability to confirm" — fill-then-user-clicks-submit is the safe design. Review backlog: Google confirmed 28+ day waits Apr–May 2026; `<all_urls>` 1–3 weeks, +1–2 weeks for new developer accounts. https://developer.chrome.com/docs/webstore/program-policies/policies https://groups.google.com/a/chromium.org/g/chromium-extensions/c/VJ6DcpEn51Y/m/yuxvHWdwCAAJ
- Greenhouse candidate agreement bars "automated means… to access or use the Services." Greenhouse Fraud Detection gives employers per-application risk reports (IP, user agent) with a "Security concern rejection" button. Extension fill from the user's residential IP is least exposed; server-side headless is most exposed. https://my.greenhouse.io/users/agreement https://support.greenhouse.io/hc/en-us/articles/45397259312027
- Workday site terms ban unconsented automated interaction on workday.com (tenant sites are customer-governed). Lever ToS has no anti-bot clause. No lawsuits or C&Ds found against auto-apply tools; LinkedIn actively sues scrapers (ProAPIs, settled Feb 2026).
- Gmail `gmail.readonly` is a restricted scope → CASA assessment ($540–1,800 lab fee, 1–3 weeks lab time, several weeks total, annual re-test). Not a 4-week item. https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- California Civ. Code §1812.501: a "job listing service" is anyone who for a fee paid by the jobseeker provides lists of openings or prepares résumés. $10,000 bond, ≤90-day contracts, 3-day cancellation, refund rules. Active private litigation (Solorzano v. Pathrise, 2024). NY GBL §171 similar. Virginia repealed its employment-agency regs. → Geo-gate CA and NY at launch. https://california.public.law/codes/civil_code_section_1812.501
- AI-hiring laws (NYC LL144, Colorado SB 26-189 eff. 2027, Illinois HB 3773, EU AI Act) bind employers/deployers; ranking jobs for a candidate is low exposure. Never sell employer-side screening.
- VCDPA (Virginia): race, health, sexual orientation, citizenship/immigration status are sensitive data requiring opt-in; $7,500/violation. Storing EEO/visa answers server-side is the trap. Keep client-side only.
- Resume fabrication: 62% of hiring managers report firing over AI-inflated résumés (vendor survey, n≈1,000). No vendor liability case found; exposure is reputational and UDAP. Constrain the model to rephrase user-supplied facts; diff-highlight changes; require user attestation.

## 3. Demand and willingness to pay

- CC students: ~2/3 part-time; ~80% of part-timers work while enrolled; 29% are 25+; 57% below 200% of poverty. https://ccrc.tc.columbia.edu/wp-content/uploads/2025/12/Introduction-to-Community-Colleges-and-Students.pdf
- NOVA: 53,810 fall headcount; 6,197 graduates/yr; 13,863 transfers/yr (transfers outnumber graduates 2:1). https://www.nvcc.edu/about/offices/strategic-insights/achievement.html
- No survey isolates CC students' job-search channels or application counts. NACE/Handshake samples are bachelor's-only. We would be building on inference.
- Freemium benchmarks (RevenueCat 2026): median freemium conversion 2.1% by day 35; year-1 annual-plan churn ~72%; AI apps retain 36% worse. Student price ceiling anecdotally ~$10–12/mo. https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026
- Only ~1 in 3 Class of 2025 grads used AI in job search; 30% of non-users cite ethics, 16% fear employer reaction. https://www.insidehighered.com/news/student-success/life-after-college/2025/10/16/students-weigh-ai-assisted-job-searches
- Recent-grad unemployment: CS 7.0%, computer engineering 7.8%, nursing 2.1%, education ~1%. https://www.forbes.com/sites/michaeltnietzel/2026/02/23/unemployment-and-underemployment-rates-among-recent-college-graduates/
- Frontline applications: 72% mobile in hospitality/transport; sub-5-minute flows complete at 12.5% vs 3.6% for >15 min; Indeed's March 2026 rule pushes frontline employers toward Indeed Apply. Autofill has little to do here. https://www.pin.com/blog/applicant-drop-off-rates/
- Causal evidence: algorithmic writing assistance → +8% hires, +10% wages, no drop in employer satisfaction, biggest for weaker writers (NBER w30886). Employer-side GenAI created congestion: hire probability 19%→15%. No causal evidence for AI matching or auto-apply improving outcomes. https://www.nber.org/papers/w30886
- Seasonality: entry-level peaks Jan–Mar and Sep–Oct; subscribe-on-search, cancel-on-hire; effective lifetime 1–3 months. Monthly pricing invites this.

## 4. Growth channels

- Simplify's actual playbook: one viral LinkedIn post → waitlist; 25,000 business cards dropped on dense residential campuses; college mailing lists were "shouting into the void"; durable channel is the 45K-star GitHub internship list with Simplify apply links. https://consumerstartups.substack.com/p/simplify-0-1m-arr-playbook-behind
- Jobright: 50K users in ~2 months with no marketing spend, driven by the H-1B filter (narrow wedge); 58% direct traffic, only ~13K organic keywords — SEO is not their engine. https://techcrunch.com/2024/06/25/jobright-uses-ai-to-help-foreign-workers-navigate-the-us-job-market/
- AIApply: one in-house creator, 300+ TikToks, 20M+ views, top video 7.3M ("job market is cooked"), $25K MRR. The only documented $0 path to real revenue in this category. https://playkit.substack.com/p/aiapply-app
- Tactiq (Chrome extension): 150K users from $1,820 across 16 micro-creators; persona hooks beat generic by >10x. https://www.indiehackers.com/post/how-this-chrome-extension-acquired-150k-users-with-tiktok-2bec088c92
- Campus ambassadors: 21% of students downloaded because of one; 7% still use it. No evidence they work at commuter schools. NOVA has no dorms, 6 campuses. Skip.
- Reddit: 68% of subreddits with a policy ban self-promotion; zero subs >1M allow it. No job tool documented growing from founder Reddit posts. Reply helpfully without links only.
- Programmatic SEO: 3–6 months minimum on a fresh domain; Teal took years to DR 72. Post-month-3 item.
- NOVA career services: currently Symplicity, mid-migration to Handshake Fall 2026 — zero bandwidth for an unvetted student tool. Realistic ask is a spring workshop slot, not an email blast.
- Product Hunt 2026: non-front-page 50–300 visits; one launch: 746 visits → 32 signups.
- Referral loops: median K≈0.04; job search is private and competitive. Retention feature, not acquisition.
- Every documented $0 success had a narrow wedge or one on-camera creator posting daily for months. "All majors at NOVA" is neither.

## 5. Unit economics and technical risk

- LLM (Sept 2026, per 1M tokens): Haiku 4.5 $1/$5; Sonnet 5 $2/$10; GPT-5.6 Luna $0.20/$1.20; Gemini 3.1 Flash-Lite $0.25/$1.50. Tailor (4K in/1.5K out): Sonnet $0.023 (~$0.016 cached), Haiku $0.0115, Luna $0.0026.
- Paid user at heavy use (10 tailors/day) on Sonnet ≈ $9.40/mo → ~32% gross margin at $14.99. At realistic 3/day ≈ 74%. Route free tier to a cheap model and cap by month, not day: 10K free users at 3/day on Sonnet = $20K/mo.
- Job feeds: Adzuna is not viable commercially (250 calls/day, 14-day trial, badge required). TheirStack ≈ $49K/mo at 1.5M jobs. Coresignal ≈ $3K/mo. Fantastic Jobs ≈ $1–1.5K/mo. Only free commercial source: ATS public feeds (Greenhouse/Lever/Ashby), which throttle abusive polling. "50K fresh US postings/day across all industries" costs $1–3K/mo before revenue.
- Supabase + pgvector at 1M × 1536-dim needs XL–4XL compute ($210–410+/mo); use halfvec + 512-dim embeddings. Fixed infra: ~$170/mo at 0 users (no aggregator), $1.4–2.8K at 1K users, $2.5–4.5K at 10K.
- Chrome MV3: service worker dies after 30s idle; content scripts obey page CORS (route API calls through the SW); Greenhouse embeds in iframes (`all_frames: true`); remote JSON config allowed, remote JS not; `storage.sync` is 100KB (resume JSON won't fit).
- Workday: two major releases/year plus weekly updates; every tenant configures its own steps and custom questions; `data-automation-id` is a test hook, not a contract. OSS Workday adapters with 400+ commits still list "complete Workday functionality" as a milestone. Estimate: 2–4 weeks to basic, 2–3 months to "mostly works," permanent ~0.2 FTE maintenance. Greenhouse/Lever: 3–5 days each.
- Inbound email: Cloudflare Email Routing is free and unlimited inbound. Classification ~90–95% on clear rejection/interview, worse on company attribution; needs a manual-correction UI.
- Resume PDF: @react-pdf/renderer (fast, flexbox-only) is the pragmatic default.

## PLAN CHANGES (supersede PLAN.md until re-planned)

1. Wedge: NOVA/GMU-bound IT and business students (and their equivalents at GMU), not all majors. The founder is the persona. Expand only on evidence.
2. Launch web-first. Extension is submitted to the Chrome Web Store the day it's functional but does not gate launch. Ship Greenhouse and Lever adapters; Workday only after paid users ask for it.
3. Core value = tailoring quality with a hard no-fabrication rule and a visible diff of every change. Match/fit is secondary. No auto-apply, ever, in v1.
4. Pricing: semester pass ($29–39 one-time) and a per-search pass, not $14.99/mo. Free tier capped monthly, routed to a cheap model.
5. Job data: ATS public feeds only (Greenhouse/Lever/Ashby) plus the NOVA/DMV employer list. No paid aggregator until revenue covers it.
6. Geo-gate California and New York at checkout until counsel or compliance.
7. EEO/demographic answers never leave the browser.
8. One channel: founder-face short video, 3–4/week, persona hooks for NOVA transfer students, from week 1 of build — not week 3. Second: a public, maintained "NoVA entry-level/part-time jobs for students" list with the tool as the apply layer.
9. Cut: campus ambassadors, Reddit posting, career-services email, programmatic SEO (before month 3), Gmail OAuth (until CASA), paid aggregator, referral-as-acquisition.

## KILL CRITERIA (30 days after web launch)

- <300 signups from the wedge with videos posted 3–4/week → channel doesn't work for this founder; stop.
- <3% of active users buy a pass → the segment won't pay; stop or go employer-side.
- No measurable callback lift in the tracker by 500 tracked applications → tailoring value isn't real here; stop.
- Any Greenhouse "security concern" rejections attributable to the extension → disable the extension.

## ALTERNATIVES IF THIS DIES

- Employer-side / cleared-federal vertical (see earlier session notes): sells to the side with money, uses the Salam Consulting and DMV network, slower start, needs a sales co-founder.
- Infrastructure: submission API sold to other tools and career centers — only viable once an adapter set exists and works.
