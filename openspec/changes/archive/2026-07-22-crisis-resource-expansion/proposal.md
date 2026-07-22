## Why

M2's crisis-safety net only had real, verified resources for 3 countries (Canada, US, UK); the other 9 in the sign-up dropdown (Australia, New Zealand, Ireland, India, Germany, France, Netherlands, Sweden, Singapore) silently fell through to a generic international fallback if a crisis was ever actually flagged — a real gap between what the sign-up screen implied ("we have something specific for you") and what the backend could actually deliver. Caught 2026-07-22 while answering an unrelated question about the country dropdown. Robin's explicit instruction once the gap was found: only offer a country at sign-up if it has a real, verified backing resource — otherwise it's a liability, not a convenience.

This is rule-5 sensitive (crisis-safety detection, per CLAUDE.md's 2026-07-21 update) and per CLAUDE.md's development-process note, M2 (crisis-safety) requires the two-instance `chat`/`cli` process. **This change was proposed and applied by a single instance (`chat`) with full research context — it has not yet received the independent grading pass that process calls for.** The instance grading this should verify the sourcing and code independently, not defer to this document's own claims of correctness.

## What Changes

- Expand `backend/src/config.ts`'s `CRISIS_RESOURCES` map from 3 to 31 real, individually-sourced country entries — researched live via web search against primary/official sources (government health ministries, the resource org's own site), not recalled from training data. Sourcing detail and confidence levels for each entry were captured during research; see the session's conversation log if the actual source URLs are needed for spot-checking (not duplicated into this file to avoid this document silently going stale as sources move).
- Fix a real, already-live bug found in the process: Canada's entry displayed the superseded org name "Talk Suicide Canada" instead of "988: Suicide Crisis Helpline" (renamed November 2023). The phone number (`988`) was already correct — this is a display-name/description fix, not a broken number.
- Restrict `web/src/lib/detect-country.ts`'s sign-up country list to exactly the set of countries with a real `CRISIS_RESOURCES` entry — no country is offered as a choice unless the backend can actually back it. All 12 previously-listed countries are retained (all were independently verified); 19 new countries are added.
- Deliberately excludes several countries investigated but found to have no single, clean, national 24/7 line: Italy, Turkey, Saudi Arabia, Bulgaria, Cyprus. Also excludes Belgium, which has three real regional lines but no single national one — the current data model is one resource per country, and inventing a single "Belgium" entry from three regional ones would misrepresent which one a given user would actually reach. Both the Italy and Belgium cases are logged in the spec's Section 24 Parking Lot as a known region/language-granularity gap, not silently dropped.
- Adds regression test coverage (`crisis-safety.test.ts`) asserting the dropdown's country list and the backend's resource map can't silently drift apart, since there's no compile-time link between the two (they live in different npm workspaces).

**Explicitly out of scope:** any change to the actual crisis-detection classifier logic, the safety-card UI, or the redirect-non-suppression rule — this change only touches which countries have a real resource and what that resource's content is.

**Also investigated, not acted on:** ThroughLine (throughlinecare.com, the company behind the existing generic fallback's findahelpline.com), a commercial API/widget covering 170+ countries with region-level refinement that could resolve the region/language granularity gap this change accepts. No public pricing; requires a negotiated "service order" and a sales conversation. Logged in `FIXLIST.md` as an open item, not pursued further in this change.

## Capabilities

### Modified Capabilities
- `crisis-safety-net`: the resource-selection behavior itself (live check, inline surfacing, country-sourced lookup, generic fallback) is unchanged — see `design.md`'s Decisions for why this is additive data, not a behavior change. One new requirement is added: the sign-up flow must only offer countries with a real backing resource.

## Impact

- `backend/src/config.ts`: `CRISIS_RESOURCES` grows from 3 to 31 entries; Canada's entry corrected.
- `web/src/lib/detect-country.ts`: `COUNTRIES` array grows from 13 (12 + Other) to 32 (31 + Other).
- `backend/src/conversation/crisis-safety.test.ts`: one existing test's example country changed (Germany → Italy, since Germany now has a real entry); two new tests added.
- No schema changes, no changes to the crisis-detection classifier, no changes to `sessions.crisis_flagged` handling.
- Verified: `npm run lint|typecheck|test|build --workspaces --if-present` clean; 42/42 backend tests passing (39 pre-existing + 3 new), 2/2 web tests passing.
