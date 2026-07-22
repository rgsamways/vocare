## Context

M2 shipped a complete text-based conversation flow: `ConversationPage.tsx` has a text composer as its only input path, and `sessions`/`transcript_turns` have no notion of how a turn's content was captured. The spec's data model (Section 3) has called for `sessions.mode` (voice/text) since M1, but it was never added because M2 was text-only and the gap didn't matter yet.

This change adds a mic-capture input path on web, using the browser-native Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`), alongside — not instead of — the existing text composer. Mobile voice capture (`expo-speech-recognition`, `expo prebuild`) is explicitly deferred to M10; see `proposal.md`'s Why. This is a decision made with Robin on 2026-07-22, not a gap discovered during implementation.

## Goals / Non-Goals

**Goals:**
- A user can speak a turn instead of typing it, on Chrome/Edge (and any other browser exposing a working `SpeechRecognition`), with the recognized text landing in the same composer/submit path M2 already uses.
- Typed text remains fully first-class in every browser, including ones with no speech recognition at all — never a degraded "voice-only" experience with typing as an afterthought.
- `sessions.mode` is recorded per session, closing the spec's long-standing data-model gap.
- Filler-word preservation is checked against the real feature's real output, not assumed.

**Non-Goals:**
- Not building mobile voice capture, `expo-speech-recognition`, or `expo prebuild` — deferred to M10 (decided 2026-07-22).
- Not building AI text-to-speech — parked, spec Section 24.
- Not building a dedicated filler-word test harness or throwaway test page — the in-situ verification task in this change is the entire scope of that check for M3 (decided 2026-07-22).
- Not changing crisis-safety-net logic — it already operates on turn `content` regardless of capture method.

## Decisions

**Mic control is additive to the existing composer, not a mode switch between two separate UIs.** A single composer with a mic button: tapping it starts `SpeechRecognition`, interim/final results populate the same text field the user could otherwise type into, and the existing submit button/flow is unchanged. This keeps the "typed text is first-class, not a fallback" requirement literally true in the UI — there's only ever one text field, one submit path.

**Feature detection, not user-agent sniffing, decides whether the mic button renders.** Check for `window.SpeechRecognition || window.webkitSpeechRecognition` at runtime. If absent (Firefox today; any future browser), the mic button simply doesn't render — the composer looks and works exactly like M2's, no error state or broken affordance to build. This is more robust than a browser-name allowlist, which breaks the moment a browser's support status changes.

**Safari's PWA-context quirks are handled by the same feature-detection path, not special-cased.** Safari's speech-recognition behavior varies enough by context (permissions prompts, PWA vs. browser tab) that trying to special-case it correctly is its own research project; instead, if `SpeechRecognition` construction or the `start()` call throws/errors, the mic button falls back to disabled + the same "use text" experience as an unsupported browser, discovered generically rather than enumerated per-platform.

**`SpeechRecognition.continuous` is `true`, not `false`.** Found during Robin's manual verification pass: with `continuous: false`, the browser's own endpointer auto-stops recognition as soon as it thinks one utterance ended, and that pause-detection appeared to get more aggressive with repeated use in the same tab — recognition cut users off mid-thought after a few responses, not just on the first try. Switched to `continuous: true` so stopping is purely user-driven (tapping the mic button again), not heuristic. Recorded here rather than treated as fully explained, since Chrome/Edge's exact endpointer behavior isn't publicly documented — same "record what was observed, don't claim a universal guarantee" posture as the filler-word check below.

**`sessions.mode` is set once at session start and does not change mid-session, even if the user mixes voice and typed turns.** Mirrors the existing `personaAgeRange`/`personaGenderPresentation` pattern (design.md precedent from M2): chosen once, stored on the row, not re-derived per turn. `mode` reflects how the session was *started* (the primary input path offered), not a strict enforcement that every turn used that method — a user can always type during a voice session or vice versa, since text stays first-class regardless.

**Filler-word check: manual inspection of real raw `SpeechRecognition` results during this change's own verification pass, recorded as a finding — not a separate test harness.** Per the 2026-07-22 decision with Robin, no throwaway page gets built. Verification task 7.x (see `tasks.md`) is: speak a test phrase containing deliberate "um"/"uh" during real manual testing of the shipped mic control, inspect what actually lands in the composer text and then in `transcript_turns`, and record the result directly in this design doc's Open Questions / in a `tasks.md` note. If filler words are stripped, that's handed to M6 as a known constraint, not solved here.

## Risks / Trade-offs

- **Different Chrome/Edge versions or OS-level dictation settings could produce inconsistent filler-word behavior even within "supported" browsers.** → Mitigation: the in-situ check (see Decisions) records what was actually observed on the browser/OS used for verification; not claimed as a universal guarantee across every Chrome/Edge build.
- **A user's `sessions.mode` value could become misleading if they primarily type during a "voice" session (or vice versa).** → Mitigation: `mode` is documented (in the schema comment and here) as reflecting session-start intent, not a strict per-turn enforcement; M4/M6 consumers of `mode` should treat it accordingly, same honesty-over-precision approach the spec already takes elsewhere (e.g. `crisis_flagged`).
- **Speech recognition permission prompts (mic access) could confuse users who don't expect them.** → Mitigation: the mic button only requests permission when actually tapped, not on page load; if permission is denied, the same disabled-mic/text-still-works fallback applies.
- **The production migration + Railway deploy for `sessions.mode` is rule-5 sensitive (database migrations, deployment config).** → Mitigation: flagged explicitly in `proposal.md` and `tasks.md`; confirm with Robin before running the production migration/deploy step, per CLAUDE.md rule 5 and the Deployment note's standing policy.

## Migration Plan

- New column via `drizzle-kit`: `sessions.mode` (`text`, enum `voice`/`text`, `NOT NULL`, no default — every session-start call must explicitly choose one, same explicitness as `personaAgeRange`/`personaGenderPresentation`).
- Apply locally first (Docker Postgres, port 5434), confirm schema, then apply to production via the `Postgres` service's public proxy (`DATABASE_PUBLIC_URL`), per CLAUDE.md's Deployment note — **confirm with Robin before running against production**.
- Deploy backend to Railway (`railway up --service vocare`) as part of this module being "done," per the same note.
- No backfill needed for existing rows from M1/M2 testing — this is pre-launch (no real user data yet, same rollback posture M1/M2 used).
- Rollback: if the migration or deploy causes an issue, no production traffic depends on `sessions.mode` yet (pre-launch) — rollback is reverting the migration and redeploying the prior backend version, same posture as M1/M2's precedent.

## Open Questions

- **Does the Web Speech API preserve filler words ("um"/"uh") in its raw transcript?** Answered by Robin's manual verification pass (task 4.6, Chrome/Edge on Windows): **no** — "um" and "uh" were stripped from the recognized text before it ever reached the composer. This is the browser's own recognition service normalizing speech, not something this app's code touches or could preserve. Handed to M6 as a known constraint: any feature relying on disfluency detection ("um"/"uh" counts, hesitation analysis) cannot use voice-mode transcripts as a source for that signal, at least not on the browser/OS combination tested here.
- **Exact mic-button visual/placement within the composer** — a craft/UI decision to make against the existing `mockups/interface-v1.html` visual language during implementation, not finalized by this design doc.
