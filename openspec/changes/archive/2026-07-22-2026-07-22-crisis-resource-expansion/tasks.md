## 1. Research

- [x] 1.1 Research real, sourced crisis hotlines by country via live web search against primary/official sources — not recalled from training data
- [x] 1.2 Explicitly identify countries with no clean single national 24/7 line (Italy, Turkey, Saudi Arabia, Bulgaria, Cyprus) rather than guessing at an approximate number for them
- [x] 1.3 Identify countries with real resources but no single national line due to regional/language fragmentation (Belgium; Italy's South Tyrol case found via a Robin-provided `findahelpline.com` URL) — logged as a data-model gap, not solved here
- [x] 1.4 Investigate ThroughLine (throughlinecare.com) as a possible vendor alternative — confirmed no public pricing, requires a negotiated service order; logged in `FIXLIST.md`, not pursued further

## 2. Backend

- [x] 2.1 Expand `CRISIS_RESOURCES` in `backend/src/config.ts` from 3 to 31 entries, each with name/contact/description/`tel:` href
- [x] 2.2 Fix Canada's entry: "Talk Suicide Canada" → "988: Suicide Crisis Helpline" (number unchanged, already correct)
- [x] 2.3 Document sourcing basis and the deliberate-exclusion rationale directly in `config.ts`'s comment, so the file itself explains its own limits

## 3. Frontend

- [x] 3.1 Restrict `web/src/lib/detect-country.ts`'s `COUNTRIES` array to exactly the countries with a real `CRISIS_RESOURCES` entry (31 + "Other")
- [x] 3.2 Confirm all 12 previously-listed countries are retained (none dropped — all independently verified)

## 4. Tests

- [x] 4.1 Update the existing "falls back to generic for unmapped country" test: Germany → Italy (Germany now has a real entry; Italy is a deliberate, sourced exclusion)
- [x] 4.2 Add a spot-check test resolving several of the newly-added countries to real, non-generic resources
- [x] 4.3 Add a regression test hardcoding the dropdown's country list and asserting every one has a matching `CRISIS_RESOURCES` entry, and that the counts match exactly — catches future drift between the two workspaces

## 5. Verification

- [x] 5.1 `npm run lint|typecheck|test|build -w @vocare/backend` — clean, 42/42 tests passing
- [x] 5.2 `npm run lint|typecheck|test|build -w @vocare/web` — clean, 2/2 tests passing
- [x] 5.3 **Independent grading per CLAUDE.md's two-instance mandate for crisis-safety work.** Second instance re-ran lint/typecheck/test/build (all clean, 42/42 backend + 2/2 web), independently spot-checked Germany, Japan, Mexico, and South Korea against live sources, sanity-checked all six exclusions (Italy, Turkey, Saudi Arabia, Bulgaria, Cyprus, Belgium) against primary sources, and confirmed the dropdown/`CRISIS_RESOURCES` lists match exactly (31 entries each). No factual errors found; one process note — a WebSearch summary briefly fabricated a nonexistent Cyprus "1401" line, caught and refuted via direct primary-source fetches, so the Cyprus exclusion stands.
- [x] 5.4 Graded — proceeding to `openspec archive`, commit, and push, scoped to this change's own files only (the working tree also has unrelated in-progress work — a sign-out button and a segmented date-of-birth input — left untouched).
