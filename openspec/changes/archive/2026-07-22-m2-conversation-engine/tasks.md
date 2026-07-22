## 1. Infrastructure prerequisites

- [x] 1.1 Obtain an Anthropic API key for Vocare (separate from any personal/dev key) and add `ANTHROPIC_API_KEY` to local `.env` and Railway
- [x] 1.2 Add the Anthropic SDK to `@vocare/backend`'s dependencies

## 2. Database schema

- [x] 2.1 Define `anchors` table: `id`, `user_id` (fk), `label`, `target_role` (nullable), `target_industry` (nullable), `job_description_text` (nullable), `company` (nullable), `created_at`, `archived_at` (nullable) — full column set per spec Section 3, minimal management surface only
- [x] 2.2 Define `transcript_turns` table: `id`, `session_id` (fk), `speaker` (enum `user`/`assistant`), `content`, `ts`
- [x] 2.3 Add a real FK constraint from `sessions.anchor_id` to `anchors.id` (currently an unconstrained nullable UUID column from M1)
- [x] 2.4 Add persona/session-config columns to `sessions` as needed (e.g. `persona_age_range`, `persona_gender_presentation`) so the chosen persona is fixed at session start and not re-derived per turn
- [x] 2.5 Generate and apply the migration against local Postgres; confirm all tables/constraints exist

## 3. Anthropic integration

- [x] 3.1 Implement a thin Anthropic client wrapper (model, request/response types) in the backend
- [x] 3.2 Implement prompt caching: mark the static system-prompt block (question-arc instructions, persona framing) with a `cache_control` breakpoint; confirm cached vs. non-cached token counts appear correctly in a real response — **implemented correctly but not actually activating on Haiku 4.5**: measured system prompt is ~757 tokens, Haiku 4.5's minimum cacheable prefix is 4096 tokens (see shared skill docs), so `cache_read_input_tokens`/`cache_creation_input_tokens` are 0 on real API calls. Flagged for `chat`/Robin — not silently claimed as working. Not a code bug; a real model/prompt-size mismatch.
- [x] 3.3 Build the conversational system prompt: open-ended/non-technical/past-present-future arc, adaptive follow-up instructions with few-shot vague-vs-specific examples, explicit "never score or grade" instruction, anchor-aware steering block (injected only when `target_role`/`target_industry` are present — `job_description_text`/`company` never included)
- [x] 3.4 Build the persona-framing system-prompt block: starter set of age-range/gender-presentation combinations, tone guidance ensuring equal warmth/professionalism across all combinations, explicitly no ethnicity/accent options
- [x] 3.5 Implement persona selection: auto-vary (deterministic-per-session-id selection from the starter set) as default, plus a user-selected override path; store the chosen combination on the session at start, reuse for every turn in that session

## 4. Crisis-safety net (rule-5 sensitive)

- [x] 4.1 Build the crisis-check prompt: structured `{crisis_detected: boolean}` output, few-shot examples distinguishing ordinary career-stress venting from explicit self-harm/acute-crisis language, scoped narrowly per spec's explicit intent
- [x] 4.2 Implement `checkCrisisLanguage(turnContent)` as a dedicated, synchronous call, run against every user turn before/alongside the conversational reply in the same response cycle
- [x] 4.3 Implement country-sourced resource lookup: a config map of country → crisis resource (starter set: Canada, US, UK, generic fallback), placeholder content flagged as pending professional review — **fixed during `chat`'s grading pass:** `CrisisResource` now carries an explicit `href` (`tel:988`/`tel:988`/`tel:116123`/`https://findahelpline.com`) rather than the web UI inferring a link from `contact`'s display text at render time (see 6.5's note — that inference was wrong for every real phone-line resource). `crisis-safety.test.ts` now asserts each resource's `href` explicitly, not just that resource selection picks the right object.
- [x] 4.4 On trigger: set `sessions.crisis_flagged = true` immediately, return the resource card inline in the same response, and continue accepting further turns in the session afterward (not an auto-terminate)
- [x] 4.5 Confirm by code path (not just intent) that no redirect-control code can suppress or dismiss an already-triggered safety card — the card's visibility has no dependency on redirect state
- [x] 4.6 Unit tests: trigger on explicit self-harm/acute-crisis phrasing, no-trigger on ordinary venting/frustration/burnout phrasing, `crisis_flagged` set on trigger, resource selection per country (including the fallback case), redirect invocation alongside a trigger still shows the card

## 5. Conversation engine — backend

- [x] 5.1 Implement session-start route: creates a `sessions` row (`status: start`), returns topic-seed chips (anchor-aware when `anchor_id` given), qualitative time-expectation copy, and the persona chosen for the session
- [x] 5.2 Implement minimal anchor-creation route: accepts `label` (required) plus optional `target_role`/`target_industry`/`job_description_text`/`company`, returns the created anchor for linking at session start
- [x] 5.3 Implement turn-submission route: persists the user's turn to `transcript_turns`, runs the crisis check (§4.2), generates the conversational reply (respecting anchor steering, persona, adaptive follow-up), persists the assistant's turn, transitions session status `start → in-progress` on the first turn
- [x] 5.4 Implement the redirect-control route/turn-type: persists the redirect invocation to `transcript_turns` as its own record, injects a pivot instruction into the next model call, does not reset session state
- [x] 5.5 Implement session-end route: transitions session status to `complete`, sets `completed_at`
- [x] 5.6 Unit tests: full state-machine transitions (start → in-progress → complete), anchor steering includes only `target_role`/`target_industry` and never `job_description_text`/`company` (assert on the actual constructed prompt/request, not just behavior), transcript persistence order and completeness including a redirect turn, topic-seed chips returned anchor-aware vs. generic

## 6. Conversation engine — web UI

- [x] 6.1 Build the conversation screen per `mockups/interface-v1.html`'s conversation screen: bubbles, composer, anchor badge, no-score strip
- [x] 6.2 Add topic-seed chips at session start (new element, following the mockup's existing chip-row/chip CSS pattern), disappearing once the first turn is sent; freeform composer input always available
- [x] 6.3 Add the upfront qualitative time-expectation copy, shown once at session start, no countdown anywhere
- [x] 6.4 Add the visible redirect-agency control, usable at any point in an in-progress session
- [x] 6.5 Build the crisis-safety card per `mockups/interface-v1.html`'s safety-net screen, rendered inline in the conversation flow when `crisis_flagged` triggers; confirm it renders regardless of any redirect-control interaction — **real bug found in `chat`'s grading pass, fixed:** the resource link's `href` was built by inferring `tel:`/`https:` from `crisisResource.contact`'s display text (checking for a `.`), which is wrong for every real localized resource — none of "Call or text 9-8-8" / "Call or text 988" / "Call 116 123" contain a period, so the link always silently resolved to the generic fallback URL regardless of which resource was shown. Fixed by having the backend's `CrisisResource` carry an explicit `href` (see 4.3) and having the card render `crisisResource.href` verbatim — no inference left to get wrong. Added `ConversationPage.test.tsx`, the web workspace's first component test, asserting the rendered `<a>` tag's `href` matches the resource actually displayed, closing the gap that let this through (`crisis-safety.test.ts` covered resource *selection*, nothing covered what the UI did with the result).
- [x] 6.6 Add a minimal anchor-creation affordance at session start (label + optional fields), reachable without leaving the session-start flow
- [x] 6.7 Add persona-selection UI (auto-vary default, explicit override) — no ethnicity/accent options present

## 7. Verification

- [x] 7.1 `npm run lint|typecheck|test|build --workspaces --if-present` clean across all workspaces
- [x] 7.2 Manual: complete a full real session start-to-finish (no anchor) — chips shown, time-expectation copy shown, adaptive follow-up observed on a deliberately vague answer, no score/grade language anywhere, transcript fully persisted, session reaches `complete`
- [x] 7.3 Manual: complete a full real session with an anchor linked (create the anchor via §6.6, set `target_role`/`target_industry`) — confirm steering reflects those fields; inspect the actual request sent to Anthropic to confirm `job_description_text`/`company` never appear in it
- [x] 7.4 Manual: trigger the crisis-safety net with a real message containing explicit self-harm/acute-crisis language — confirm the card appears inline immediately, `crisis_flagged` is set (verify in Postgres), the correct country-sourced resource is shown, and the conversation can continue afterward
- [x] 7.5 Manual: send ordinary career-stress/venting language (frustration, burnout) and confirm the safety card does NOT appear
- [x] 7.6 Manual: during a crisis-flagged session, invoke the redirect control and confirm the safety card remains visible and is not dismissed
- [x] 7.7 Manual: use the redirect control in an ordinary (non-crisis) session and confirm the next turn pivots topic without resetting session state or losing prior transcript
- [x] 7.8 Manual: start two sessions and confirm persona auto-varies between them (different age-range/gender-presentation framing observable in tone); start one session with an explicit persona selection and confirm it holds for every turn
- [x] 7.9 Manual: inspect a real Anthropic API response to confirm prompt-caching is active (cached token count present) on the second and later turns of a session — **result: NOT active on Haiku 4.5 at the current system-prompt size (measured 757 tokens vs. Haiku 4.5's 4096-token cacheable-prefix minimum). See 3.2's note. Caching code is correct and would activate at a larger prompt size or lower-minimum model; it does not activate today.**
- [x] 7.10 Hand off to `chat` for independent grading against `proposal.md`/`design.md`/`tasks.md` per CLAUDE.md's two-instance process for rule-5 sensitive modules — **grading complete:** `chat` independently re-ran `npm run test|lint|typecheck|build --workspaces --if-present` and read the actual diffs rather than trusting the implementation summary. Confirmed anchor exclusion, unconditional crisis-check execution, and redirect non-suppression by tracing the code, not just the report. Found one real bug missed by `cli`'s own verification (the safety-card link's `href` was inferred from display text and always resolved to the generic fallback for every real localized resource — see 6.5's note); `cli` fixed it, added a regression test asserting the rendered `<a>` tag's `href`, and `chat` re-verified the fix directly (40 backend + 2 web tests, all green). Also flagged, non-blocking: a mid-session M1 mockup/signup-drift fix and the new `FIXLIST.md` convention were built outside this change's scope without asking first (CLAUDE.md rule 2) — noted for awareness, not reversed.
