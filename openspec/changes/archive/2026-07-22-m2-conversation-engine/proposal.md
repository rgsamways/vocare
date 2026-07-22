## Why

M1 gave Vocare a user who can sign in and pay; nothing yet lets that user actually have the practice conversation the whole product exists for. M2 builds the core loop — an open-ended, non-judgmental text conversation with adaptive follow-up — plus the one piece of this module that carries real-harm stakes if it's wrong: a live, per-turn crisis-safety net, since an open-ended "talk about your career" format is more likely than a scripted chatbot to surface genuine distress mid-session, and M4's async mining pass runs too late to help in the moment.

## What Changes

- System prompt: open-ended, non-technical, past/present/future question arc. Text-only (voice is M3). Never surfaces scores, grades, or evaluative language mid-session (spec Section 5's cross-module rule).
- Optional anchor input, split by liveness: a session can link to an `anchor`; only `target_role`/`target_industry` are read live to steer tone/emphasis. `job_description_text`/`company` are never read by M2 — mining-only, read for the first time in M4. No anchor linked → the generic arc is the fallback. **A minimal `anchors` table is introduced now** (id, user_id, label, target_role, target_industry, job_description_text, company, created_at, archived_at) so `sessions.anchor_id` has something real to reference; full anchor CRUD/UI, `anchor_revisions`, and archive management remain M6's scope — this change reads anchors, it doesn't let a user manage them beyond a bare create needed to exercise the feature.
- Adaptive follow-up logic: detect vague answers, prompt for one more specific detail, without becoming a technical quiz.
- Session state machine: `start → in-progress → complete`, backed by the existing `sessions.status` column (M1).
- Crisis-safety net (rule-5 sensitive): a live, per-turn check, decoupled from M4's timing. Narrow — ordinary career-stress venting never triggers it; a rare-case net for explicit self-harm/acute-crisis language only. On trigger: surfaces a crisis-resource card immediately, inline, sourced by `users.country`. Sets `sessions.crisis_flagged` the instant it fires (column already exists from M1; M1's entitlement checks already read it as an exemption). **Detection thresholds and resource content are placeholders pending professional review, not finalized by this change** — same discipline M1 used for its own placeholder thresholds.
- Topic-seed suggestion chips at session start: a few broad, non-interview-specific, tappable prompts; anchor-aware when linked (reuses the same live `target_role`/`target_industry` steering, not a new mechanism); disappear once the conversation starts; freeform input always available regardless.
- Upfront time expectation shown once at session start: qualitative only ("no need to rush"), never a live countdown, no specific number asserted (no real session-length data exists yet).
- Visible redirect agency: a subtle "let's talk about something else" control, usable anytime. **Hard rule:** this control must never dismiss or suppress a triggered crisis-safety card — the safety card stays visible regardless of any redirect action.
- Optional text-only AI persona properties (age-range, gender-presentation) via system-prompt framing only, no voice/TTS dependency. Two modes: auto-vary per session (default) or user-selected. Every persona reads as equally warm/professional — variety, not caricature. Explicitly excludes ethnicity/accent (declined, spec Section 24).
- Deliverable: a full text-based practice conversation, start to finish, stored in `transcript_turns`, with the safety net covering the one case the format wasn't originally designed to expect.

**Explicitly out of scope** (spec Section 24 parking lot — not reintroduced here): AI text-to-speech, cross-session narrative callbacks, profanity/swear-word detection, charts/graphs for feedback.

## Capabilities

### New Capabilities
- `conversation-engine`: the system-prompt-driven question arc, adaptive follow-up, session state machine, anchor-aware live steering, topic-seed chips, upfront time expectation, redirect-agency control, persona properties, and transcript persistence.
- `crisis-safety-net`: the live per-turn crisis-language check, inline resource surfacing sourced by country, `sessions.crisis_flagged` handling, and the non-suppression rule against the redirect control.

### Modified Capabilities
(none — `session-entitlement` (M1) already defines `crisis_flagged` as a column it reads; this change sets that column correctly but doesn't change M1's entitlement requirements)

## Impact

- New `anchors` table (minimal schema, no `anchor_revisions` yet — that arrives with M6's full management surface); `sessions.anchor_id` becomes a real, populatable FK for the first time.
- New backend routes: session start (returns topic-seed chips + time-expectation copy + persona for the session), turn submission (conversation reply + live crisis check + adaptive follow-up), redirect action, session end.
- New `transcript_turns` table (defined in the spec's data model, not yet created by M1).
- New Anthropic API integration (Claude Haiku 4.5) — first LLM call in the codebase; system-prompt caching considered from the start per spec Section 5's cost note.
- New web UI: conversation screen (topic chips, composer, redirect control, safety card) per `mockups/interface-v1.html`'s conversation and safety-net screens — the settled reference for the base layout; chips/time-expectation/redirect/persona-selection are new elements added to the spec after that mockup was last touched, so they follow its existing visual language (e.g. the chip-row pattern already in the mockup's CSS) rather than a literally-present screen.
- Rule-5 sensitive (crisis-safety detection, per CLAUDE.md's 2026-07-21 update): this change follows the two-instance `chat`/`cli` process — proposed and applied here, graded independently from the persisted `proposal.md`/`design.md`/`tasks.md` files alone.
- Touches M1's entitlement code only by consuming `sessions.crisis_flagged` correctly; M1's free-session/velocity-cap exemption logic is unchanged.
