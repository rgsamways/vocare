## Why

M2 gave Vocare a complete text-based practice conversation; the spec's M3 slot exists to make that same conversation voice-capable, since a spoken practice conversation is closer to what a real interview actually feels like than typing answers into a box. This change covers the web half only — the Web Speech API integration, the fallback path for browsers without it, and the `sessions.mode` schema gap the spec has called for since M1 but that stayed unbuilt while M2 was text-only.

**Mobile voice capture is explicitly deferred to M10, decided with Robin on 2026-07-22 — not an oversight.** The spec's M3 bullet describes voice capture "on mobile" too, but `mobile/App.tsx` is still the untouched Expo default template: no auth screen, no conversation screen, nothing for a mic control to attach to. Building `expo-speech-recognition` now (which requires `expo prebuild`, a real one-way step out of plain Expo Go) against a nonexistent UI would mean verifying it via a throwaway test screen, then likely revisiting the integration anyway once M10 builds the real mobile conversation screen. M10 already owns wrapping M1–M6 into the Expo app shell — mobile voice capture waits for that real screen to exist.

## What Changes

- Web Speech API integration in the web `ConversationPage`: a mic control added alongside the existing text composer (start/stop/listening states), not replacing it — typed input stays first-class throughout, per the spec's explicit requirement and M2's composer already being text-first.
- Explicit fallback path for browsers without usable speech recognition: Firefox has zero support, Safari has real PWA-context quirks. Fallback is simply "the mic control doesn't appear (or is disabled with a explanation) and the text composer works exactly as it does today" — no degraded voice experience to build, since typed input is already the fully-featured path.
- New `sessions.mode` column (`voice` | `text`), closing a data-model gap that has existed since M1/Section 3 but never mattered while M2 was text-only. Requires a real production migration and a Railway deploy per CLAUDE.md's Deployment note — **rule-5 sensitive (database migrations, deployment config)**, flagged explicitly for confirmation before that step runs, even though voice capture itself isn't on the sensitive list.
- Filler-word preservation ("um"/"uh" surviving into `transcript_turns`) is **verified in-situ against the real built feature, not via a throwaway test page** — decided with Robin on 2026-07-22. This is a verification task in this change, not a build task: if the Web Speech API strips disfluencies, that's a finding recorded here and handed to M6, not solved inside M3.

**Explicitly out of scope** (spec Section 24 parking lot / decided with Robin 2026-07-22 — not reintroduced here):
- Mobile voice capture, `expo-speech-recognition`, and `expo prebuild` — all deferred to M10 (see Why).
- AI text-to-speech — this module is user-voice-input (speech-to-text) only; nothing here gives the AI an actual voice.

## Capabilities

### New Capabilities
(none — voice capture is additive behavior on the existing conversation flow, not a new bounded capability of its own)

### Modified Capabilities
- `conversation-engine`: session start and turn submission now accept a `mode` (`voice`/`text`), persisted on the `sessions` row; the web conversation screen gains a mic-capture input path alongside the existing text composer, with typed text remaining fully first-class in both modes.

## Impact

- `backend/src/db/schema.ts`: add `sessions.mode` column + migration (production migration via Postgres's public proxy, per CLAUDE.md's Deployment note).
- `backend/src/routes/conversation.ts`: session-start and turn-submission routes accept/persist `mode`.
- `web/src/pages/ConversationPage.tsx`: add mic control (Web Speech API) beside the existing composer; feature-detect and hide/disable gracefully where unsupported (Firefox, Safari quirks).
- No changes to crisis-safety-net logic — the live crisis check already runs against turn `content` regardless of how that content was captured.
- Railway deploy + production migration required for this module to be "done," per CLAUDE.md's Deployment note (rule-5 sensitive step, confirm before running).
