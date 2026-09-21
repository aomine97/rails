# Rails design system — the plan and the rules

Written 2026-09-20 before the frontend pass. Every screen is measured against this, not against taste.

## 1. Evidence we design from
- **Aesthetic–usability effect** (Kurosu & Kashimura; Nielsen Norman): people judge a polished interface as easier to use and forgive small problems. Polish is not decoration; it is trust, and trust is what gets a student to click Submit.
- **Hick's law**: decision time grows with the number of options. One primary action per screen; filters as a few dropdowns, not thirty chips.
- **Fitts's law**: targets that matter are big and close. Primary buttons 44–48 px tall, full width on mobile, placed where the eye ends (bottom-right of a card).
- **Miller's law / chunking**: 5–7 items per group. Card facts in one grid of at most 6; nav of 6 real items, the rest collapsed.
- **Jakob's law**: users spend most of their time on other sites. Keep the job-board conventions they already know (logo left, title, facts row, score right, apply bottom-right) and spend novelty only on our edge: the explained match.
- **Von Restorff**: one thing stands out. Orange is the single primary action; everything else is ink, grey, or a band color on a score.
- **Gestalt proximity**: more space between groups than inside them. That alone removes most borders.
- **Doherty threshold**: respond within 400 ms; skeletons and optimistic states where the server takes longer.
- **Refactoring UI** (Wathan & Schoger): 2–3 weights, hand-picked type scale, 8–10 greys, 5 shadows, 45–75 characters per line, de-emphasize secondary elements instead of shouting with the primary, replace borders with space or shadow, empty states with one action.
- **WCAG 2.1 AA**: 4.5:1 text contrast, 3:1 for large text and UI parts, 44 px touch targets, visible focus.

## 2. Tokens (globals.css)
- **Color**. Ink `#0B1B3A` is the brand and the text. Greys: a 9-step scale from `#F7F9FC` to `#33415C`. Orange `#FF7A2E` is the primary action only. Blue `#1D4ED8` for links and the selected state. Band colors: green `#16A34A`, amber `#D97706`, red `#DC2626`, each with a chip tint. Surfaces: page `#F4F6FA`, card `#FFFFFF`, inset `#EDF1F8`.
- **Type**. Inter Tight for display (26/21/17, weight 800), Geist for text (15/14/13/12, weights 500/600/700). Nothing below 12. Body line height 1.5, display 1.15. Measure 45–75 characters (max-w 68ch on prose).
- **Space**. 4-px base: 4 8 12 16 20 24 32 40 48 64. Inside a card 20; between cards 16; between sections 32.
- **Radius**. 10 inputs, 12 buttons, 16 cards, 999 pills.
- **Shadow**. sm `0 1px 2px rgba(11,27,58,.06)`, md `0 4px 12px rgba(11,27,58,.08)`, lg `0 12px 32px rgba(11,27,58,.12)`, cta `0 6px 18px rgba(255,122,46,.35)`.
- **Motion**. 150 ms ease for hover/focus, 300 ms for layout; nothing bounces.

## 3. Components (src/components/ui.tsx)
Button (primary / secondary / ghost / icon, sizes md 40 and lg 48), Chip (neutral / info / good / warn / bad), Card, SectionTitle, PageHeader, Field (label above input, help and error under), Select, Skeleton, Empty (icon, one sentence, one action), Ring + Meters (already in match-panel), Sidebar.

## 4. Screens, in order
1. **Shell**: 232 px sidebar, wordmark with the icon, six real items with 20 px icons and 14 px labels, "Soon" items greyed and grouped under a divider, user card (avatar, name, plan) at the bottom, no top header bar (the page owns its title). Content max-width 1180, 32 px gutters.
2. **Feed** (done in the card pass): keep; align paddings to tokens; sticky filter bar.
3. **Job detail**: hero card (logo 64, chips, title 26, company line, facts grid, Apply lg + Like + Original ↗); left column: "Why this matches" (one sentence), requirements checklist with ✓ ! ✗ and evidence, tailored resume or its CTA, the posting; right column sticky: dark match rail, Tailor/Cover letter card, similar jobs.
4. **Apply companion**: same hero; left: form-field copy list as a clean table; right: checklist and resume PDF.
5. **Tracker**: stage columns with counts, card = logo + title + company + days + next step; due strip on top.
6. **Onboarding confirm**: one 640 px column, step bar, sections as cards with a title and one-line why, labels above inputs, autosave.
7. **Autopilot / Settings / Billing / Pricing**: same page header and card language.
8. **Empty, loading, error**: skeleton rows that match card geometry; empty states with a single action; inline errors under the field.
9. **Mobile**: sidebar becomes a bottom tab bar (Jobs, Tracker, Autopilot, Resume, More); cards single column; Apply sticks to the bottom.
10. **Landing**: from the mockup, after the app.

## 5. Rules that never bend
- Every score shows its number; band color follows the number (green ≥ 85, amber 70–84, red < 70).
- Orange appears once per screen.
- No text under 12 px, no grey-on-grey under 4.5:1.
- Labels above inputs; placeholders are examples, not labels.
- Nothing submits for the user.
