## 1. Database schema (rule-5 sensitive: migration + deploy)

- [x] 1.1 Add `sessions.mode` column (`text`, enum `voice`/`text`, `NOT NULL`, no default) to `backend/src/db/schema.ts`
- [x] 1.2 Generate migration via `drizzle-kit`, apply against local Postgres (Docker, port 5434), confirm the column and constraint exist
- [x] 1.3 **Confirm with Robin before proceeding** — applying the migration against production Postgres (via the `Postgres` service's public proxy, `DATABASE_PUBLIC_URL`, never the internal-only `DATABASE_URL`) and deploying to Railway (`railway up --service vocare`) are both rule-5 sensitive (database migrations, deployment config)
- [x] 1.4 Apply the migration against production Postgres and deploy to Railway; verify against a real production request (e.g. start a session, confirm `mode` is set) — per CLAUDE.md's Deployment note, this deploy is part of the module being "done," not a later step

## 2. Backend — session mode

- [x] 2.1 Update session-start route to accept and persist `mode` (`voice`/`text`) on the created `sessions` row
- [x] 2.2 Unit tests: session-start persists the given `mode`; a typed turn submitted during a `voice`-mode session is accepted and persisted normally (mode does not change)

## 3. Web — mic control

- [x] 3.1 Add feature detection for `window.SpeechRecognition || window.webkitSpeechRecognition` in `ConversationPage.tsx`
- [x] 3.2 Add a mic control to the composer (per design.md's Decisions — additive to the existing text field, not a separate mode switch): tapping starts recognition, interim/final results populate the same composer text field the user could otherwise type into
- [x] 3.3 Hide the mic control entirely when speech recognition is unsupported (no error state, composer behaves exactly as in M2)
- [x] 3.4 Disable the mic control and fall back to typed-only if `SpeechRecognition` construction/`start()` throws or errors (denied permission, Safari PWA-context restriction) — generic failure handling, no per-browser special-casing
- [x] 3.5 Wire session-start to pass `mode: voice` when the mic control is available and used to start the session, `mode: text` otherwise
- [x] 3.6 Component test(s): mic control renders when `SpeechRecognition` is present (mocked), does not render when absent; composer remains submittable via typed text in both cases

## 4. Verification

- [x] 4.1 `npm run lint|typecheck|test|build --workspaces --if-present` clean across all workspaces
- [x] 4.2 Manual, Chrome or Edge: start a voice-mode session, speak a full turn, confirm recognized text lands in the composer and submits/persists correctly, confirm `sessions.mode` is `voice` in Postgres — **real bug found and fixed along the way:** `SpeechRecognition.continuous` was `false`, which cut Robin off mid-sentence on ordinary speaking pauses; switched to `true`
- [x] 4.3 Manual: within that same voice-mode session, type a turn instead of speaking one, confirm it's accepted normally and `mode` stays `voice`
- [x] 4.4 Manual, Firefox: confirm no mic control appears and the text composer works exactly as it did in M2
- [x] 4.5 Manual, Safari (including installed-PWA context if practical): confirm either working mic capture or a clean fallback to typed-only — no broken/error UI state — **resolved, working:** tested against the real, now-live `vocare.ca` (per the push/deploy decision recorded below) on Robin's iPhone Safari; mic capture confirmed working. Getting a real test required pushing this branch to `main` first — Robin's iPhone Safari couldn't reach local dev without either LAN exposure or a tunnel, and neither would have satisfied the Web Speech API's secure-context (HTTPS, `localhost`-only exception) requirement anyway.
- [x] 4.6 **Filler-word finding (in-situ, not a separate test harness — decided with Robin 2026-07-22):** during 4.2's real manual test, speak a phrase containing deliberate "um"/"uh" and inspect the actual recognized text in the composer and the persisted `transcript_turns` row; record the observed result in `design.md`'s Open Questions and flag it to M6, whichever way it comes out — **confirmed: stripped, not preserved.**
- [x] 4.7 Confirm crisis-safety-net behavior is unaffected: trigger the existing crisis check with a voice-captured turn's recognized text, confirm it behaves identically to a typed turn (no code changes expected here — verification only)
