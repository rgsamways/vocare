## 1. Database schema (rule-5 sensitive: migration + deploy)

- [x] 1.1 Add `feedback_reports` table to `backend/src/db/schema.ts`: `sessionId` (uuid, primary key, FK to `sessions.id` — one row per session, same natural-key convention as `session_mining_results`), `coachingNotes` (jsonb array of `{ kind, note, quote? }`), `generatedAt` (timestamp, default now)
- [x] 1.2 Generate migration via `drizzle-kit`, apply against local Postgres (Docker, port 5434), confirm the table and constraints exist — done 2026-07-22: `drizzle/0005_funny_anthem.sql` generated and applied; confirmed via `information_schema.columns` that `feedback_reports` exists with the expected `session_id`/`coaching_notes`/`generated_at` columns.
- [x] 1.3 **Confirm with Robin before proceeding** — applying the migration against production Postgres (via the `Postgres` service's public proxy, `DATABASE_PUBLIC_URL`, never the internal-only `DATABASE_URL`) and deploying to Railway (`railway up --service vocare`) are both rule-5 sensitive (database migration, deployment config) — **Robin confirmed go-ahead 2026-07-23.**
- [x] 1.4 Apply the migration against production Postgres and deploy to Railway; verify against a real completed production session (confirm a `feedback_reports` row is written) — **done 2026-07-23:** migration applied via `DATABASE_PUBLIC_URL` (confirmed via `information_schema.columns`), `railway up --service vocare` deployed (confirmed `/health` 200 and `/feedback/latest` returning 401 rather than 404, proving the new route is live), Robin completed one real production session directly, and the resulting `feedback_reports` row was confirmed correct against that session's real `session_mining_results` row (ownership note present, no tradeoff/outcome/quantified-impact/audience-keyword notes since those fields were false/empty/null, clarity note matched the real "mixed" assessment, generic closing note present, `topic_relevance_score` confirmed absent from the stored report).

## 2. Note-generation module

- [x] 2.1 Create `backend/src/feedback/notes.ts`: a placeholder catalog of note templates (same convention as `CRISIS_RESOURCES`/`ROLE_LANGUAGE_REFERENCE`), covering v1's 6 categories — ownership language, tradeoff reasoning, outcome mention, clarity, quantified-impact quotes, audience-keyword quotes — plus a fixed generic closing note
- [x] 2.2 Implement `buildFeedbackReport(result: SessionMiningResultInput): CoachingNote[]`, where `SessionMiningResultInput`'s type excludes `topicRelevanceScore` entirely (see design.md's Decisions — a structural guarantee, not a rendering-time omission)
- [x] 2.3 Implement quote-selection logic for `quantifiedImpactExamples[]`/`audienceKeywordMatches[]` — real verbatim entries from those arrays, never paraphrased or invented
- [x] 2.4 Implement no-match handling: `audienceKeywordMatches: null` and empty quote-bearing arrays produce no note for that category, and no note stating an absence
- [x] 2.5 Unit tests: each of the 6 categories produces its expected note when its field is present; `audienceKeywordMatches: null` produces no audience note and no "not found" note; a mining result with nothing present for any category still returns at least one note (the generic closer); a `SessionMiningResultInput` object literally cannot carry `topicRelevanceScore` (compile-time check, e.g. a `// @ts-expect-error` test case) — 12 tests, `backend/src/feedback/notes.test.ts`, all passing; the `@ts-expect-error` case confirmed to actually catch a real compile error (verified by temporarily removing it and observing `tsc --noEmit` fail).

## 3. Mining orchestration extension

- [x] 3.1 Extend `backend/src/mining/mine-session.ts`'s `mineSession`: after the existing `session_mining_results` insert succeeds, call `buildFeedbackReport` and insert into `feedback_reports`, inside the same try/catch (a feedback-generation failure must not affect the already-written mining row or session completion)
- [x] 3.2 Unit tests: a successful mining pass produces both a `session_mining_results` row and a `feedback_reports` row; a failure in feedback generation is caught and logged without throwing, and does not roll back the mining insert — 2 tests, `backend/src/mining/mine-session.test.ts`, against the real local DB with only `extractSessionSignals` mocked (same pattern as `conversation.test.ts`).

## 4. Feedback retrieval routes

- [x] 4.1 Create `backend/src/routes/feedback.ts`: `GET /sessions/:id/feedback` — auth-gated, ownership-checked via the same pattern as `conversation.ts`'s `loadOwnedSession`; returns `{ status: "ready", report }`, `{ status: "pending" }` (session is `complete` but no `feedback_reports` row yet), or 404 for a nonexistent/unowned session
- [x] 4.2 Add `GET /feedback/latest` to the same file: finds the caller's most recently completed session and delegates to the same lookup; returns `{ status: "none" }` if the user has never completed a session
- [x] 4.3 Register the new routes in `backend/src/app.ts` alongside the existing route plugins
- [x] 4.4 Unit tests: ready/pending/none states each return the expected shape; a non-owner requesting another user's session feedback gets the same response as a nonexistent session — 7 tests, `backend/src/routes/feedback.test.ts`.

## 5. Account deletion cascade

- [x] 5.1 Add an explicit `feedback_reports` delete to `deleteUserCascade` (`backend/src/account/delete-user-cascade.ts`), matching the existing `sessionMiningResults` pattern — deleted by the owning user's session ids, ordered before the `sessions` delete
- [x] 5.2 Unit test: deleting a user with a completed, mined, feedback-generated session removes its `feedback_reports` row along with everything the existing cascade test already covers — extended `delete-user-cascade.test.ts`'s existing seed/assertions rather than adding a new test.
- [x] 5.3 **Note, not in scope to fix here:** `delete-user-cascade.ts`'s own comment already flags that `transcript_turns` isn't covered by the cascade and its FK has no `ON DELETE CASCADE` (flagged during M4, unresolved). This change does not fix that pre-existing gap — scope discipline, CLAUDE.md rule 2. Comment updated to note the gap is still unresolved as of M5.

## 6. Frontend: feedback report page

- [x] 6.1 Replace `web/src/pages/FeedbackPage.tsx`'s placeholder with a real implementation: fetches `GET /feedback/latest` by default, or `GET /sessions/:id/feedback` when reached with a session id in the route
- [x] 6.2 Render coaching notes as semantic HTML (heading + list structure) with ARIA labeling so all content is screen-reader navigable; pending/none states render as accessible text, not conveyed by styling alone — `<ul aria-label="Coaching notes for this session">`, `aria-live="polite"` wrapping the state region so loading/pending/none transitions are announced.
- [x] 6.3 Add `/feedback/:sessionId` route in `web/src/App.tsx` alongside the existing `/feedback`
- [x] 6.4 Change `ConversationPage.tsx`'s `handleEnd` to navigate to `/feedback/${sessionId}` instead of `/account` after a session ends
- [ ] 6.5 Manual accessibility pass: navigate the rendered feedback report (ready, pending, and none states) using a screen reader, confirm all content and state changes are announced — **not done by Claude.** Verified structurally (semantic elements, `aria-live`, accessible button name, confirmed via component tests) but no real NVDA/VoiceOver walkthrough was performed in this session — flagged for Robin to do directly, same as several of M4's own manual checks.

## 7. Verification

- [x] 7.1 `npm run lint|typecheck|test|build --workspaces --if-present` clean across all workspaces — confirmed 2026-07-22: all four commands clean across `shared`/`backend`/`web`/`mobile`.
- [x] 7.2 Manual: complete a real local session, confirm a `feedback_reports` row is written with notes matching that session's real `session_mining_results` row, and that no numeric score appears anywhere in the response or rendered page — verified 2026-07-22 against the real Anthropic API (not mocked): a realistic transcript (database sharding decision, tradeoff reasoning, quantified impact) produced a full report with a real verbatim quote ("cut our p99 query latency by about 60%"); `topicRelevanceScore` (95 in the raw mining row) confirmed absent from the `feedback_reports` row and from the rendered page entirely.
- [x] 7.3 Manual: complete a real session with an anchor whose `target_role` has no confident role-language match (reproducing the known production gap from M4's own verification), confirm the rendered report omits the audience-keyword category cleanly with no "not found" note — verified 2026-07-22 using `target_role: "Senior developer"` (the same real gap M4's own production verification hit): `audienceKeywordMatches: null`, report cleanly omitted the audience-keyword note, no "not found" note generated.
- [x] 7.4 Manual: complete a real session with no linked anchor, confirm the same clean omission — verified 2026-07-22: identical clean omission with no anchor at all.
- [x] 7.5 Confirm M2/M3/M4 behavior is unaffected: run an existing session end-to-end, confirm no change to conversational replies, crisis checks, transcript persistence, or the existing `session_mining_results` write (no code changes expected in those paths — verification only) — confirmed via the full backend test suite (89 tests, up from M4's 82, all previously-passing tests unchanged) plus the real-API manual verification above, which also exercised the unmodified `session_mining_results` write path end-to-end.
