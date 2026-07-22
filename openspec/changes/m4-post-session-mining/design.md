## Context

M2/M3 produce a complete `transcript_turns` record per session but nothing reads it back afterward. M5 (coaching) and M6 (progress trend) both depend on structured signal existing first; Section 17's abuse-detection proposal (topic relevance as a fair-use throttling signal) is still just prose, unwired into M1's actual `checkEntitlement`. This module is the first to read a full transcript outside the live conversation, and the first async (non-request-blocking) LLM call in the codebase — M2's crisis check and conversational reply are both synchronous, in the request path.

Existing patterns this design reuses rather than reinvents:
- `crisis-safety.ts`'s `output_config: { format: { type: "json_schema", schema } }` structured-output call — the extraction call uses the same pattern, just a larger schema.
- `reply.ts`'s per-session-fixed system prompt + `cache_control` breakpoint pattern — evaluated below and **not** adopted here (see Decisions).
- `config.ts`'s placeholder-value convention (`CRISIS_RESOURCES`, `FAIR_USE_CAP`) — the role-language reference library and the off-topic threshold both land here as explicitly-flagged placeholders pending real usage data.

## Goals / Non-Goals

**Goals:**
- Every completed session produces exactly one `session_mining_results` row, written from a single async Haiku 4.5 call triggered off `/sessions/:id/end`.
- `topic_relevance_score` actually changes `checkEntitlement`'s behavior for a user with a pattern of off-topic sessions — not just stored.
- The trigger is isolated behind one function so a later swap to the Batch API touches only this module, never `conversation.ts`.
- `filler_word_count` is not fabricated — it's absent from this module's output, with the reasoning and an explicit flag to M6 recorded here (mirrors how M3 handed its own STT finding to M6).

**Non-Goals:**
- No user-facing surface for any mining result (M5's job).
- No aggregation/anonymization (M7's job) — this module's output is per-user, per-session, and stored as-is.
- No personal practice-word dictionary extension to `audience_keyword_matches[]` (parked in spec Section 24 until M5 exists).
- No admin/review UI for abuse signals — the entitlement wiring below is fully automated, consistent with M1's existing undisclosed-threshold pattern, not a human-review queue.
- No Batch API integration in this change — only the seam that makes adding it later a one-module change.

## Decisions

**Trigger: fire-and-forget call from `/sessions/:id/end`, not a queue.** The route already transitions `status` to `complete`; it now also calls `void mineSession(session.id).catch(logMiningFailure)` after that update, without awaiting it in the response. A mining failure must never block or delay the user seeing their session end — there's no user-facing consequence to a missing mining row today (M5 doesn't exist yet), so failing loudly to the user would be a regression for no benefit. `mineSession(sessionId)` is the single seam: it currently makes one direct `anthropic.messages.create` call, but everything upstream of it (the route) and downstream of it (the DB write) is agnostic to whether that call is synchronous or a submitted-then-polled Batch job. Swapping to Batch later means rewriting the inside of `mineSession`, not touching `conversation.ts`.
- *Alternative considered:* a real job queue (e.g. a `mining_jobs` table polled by a worker). Rejected for now — no worker infrastructure exists anywhere in the codebase yet, and a single fire-and-forget call is simpler and sufficient at current volume; revisit if mining calls start measurably slowing down `/end` responses (they shouldn't, since it's not awaited) or if failures need retry logic beyond a logged error.

**Extraction call: one structured-output Haiku 4.5 call over the full transcript, reusing `crisis-safety.ts`'s `json_schema` pattern.** A single call keeps cost bounded and predictable (one call per session, not per-field), and the schema-validated output avoids the free-text-parsing fragility a prose-based extraction prompt would have. `audience_keyword_matches[]` is only requested when the session's anchor has `target_role` set; the role-language reference snippet for that role is interpolated into the prompt, and the field is simply omitted from the schema (not requested, not defaulted to empty) when there's no anchor or `target_role`.

**No prompt caching designed in for this call.** M2's own attempt was a silent no-op because its 757-token static system prompt never cleared Haiku 4.5's 4096-token cacheable-prefix minimum — worth checking here before assuming the same outcome, but two structural differences make it *less* likely to pay off even if the prompt clears the size bar: this call runs once per session (not once per turn), so there's far less repetition within a session to exploit, and cache hits only help across *different* sessions if they land within the same ~5-minute TTL, which isn't something to design around. Verification task (not a build task): measure the real static-prompt token count once the extraction prompt and role-language library are written, and record the finding — don't add `cache_control` unless that measurement shows a real win.

**Role-language reference library: a small, flagged-placeholder starter set, keyed by role category.** New `backend/src/mining/role-language.ts`, same placeholder convention as `CRISIS_RESOURCES`/`PERSONA_COMBINATIONS` in `config.ts` — a handful of broad role categories (e.g. "backend engineer," "product manager," a generic fallback) each with a short list of representative terms/phrases, explicitly marked as a starting point pending real usage data, not a comprehensive taxonomy. Matched against `anchor.targetRole` with exact/substring matching, falling back to no `audience_keyword_matches[]` output (not the generic category) when there's no confident match — a wrong-category match would be worse than no match, since M5 will eventually quote these back to the user as if they're specifically relevant.

**Topic-relevance wiring: an automated stricter fair-use check, not a review queue.** `session_mining_results.topicRelevanceScore` (0-100) is written per session. A new `getAbuseSignal(userId)` in `entitlement.ts` counts sessions in the same rolling 24h/30d windows `checkEntitlement` already queries where the joined mining result's `topicRelevanceScore` falls below a new placeholder `OFF_TOPIC_THRESHOLD` (config.ts, alongside `FAIR_USE_CAP`). When that count crosses a second placeholder threshold, `checkEntitlement` denies the session start with the existing `VELOCITY_CAP_MESSAGE` — reusing the message rather than adding a new one keeps the "undisclosed threshold" property Section 5/M1 already relies on (a user who's tripped this can't distinguish it from the ordinary velocity cap). This is the "wire it in" the spec's Section 17 asked for, sized as an extension of the existing cap rather than a new denial path.
- *Alternative considered:* blocking the *triggering* off-topic session itself in real time. Rejected — mining is async and runs after the session is already complete; the earliest point any signal from it can affect anything is the user's *next* session start, which is exactly where this wires in.

**`filler_word_count` is not produced by this module.** Confirmed via M3's real-device manual testing that the Web Speech API strips "um"/"uh" before text reaches `transcript_turns` — by the time this module reads the transcript, the raw signal is structurally absent, not just unextracted. Adding a column that's always `null`, or a status-enum column whose only real value would forever be "not applicable," is dead schema weight for a signal this module has no path to ever produce from the current STT integration. Skipped entirely rather than stored as a non-value column — flagged to M6 below (Open Questions) exactly as M3 flagged its own finding to M6.

## Risks / Trade-offs

- **[Risk] A slow or hung mining call could pile up unawaited promises under load** → Mitigation: `mineSession` wraps its Anthropic call with the SDK's own request timeout; failures are caught and logged, never retried automatically in this change (no retry queue exists yet — a repeated failure just means one missing mining row, which has no user-facing consequence today).
- **[Risk] The off-topic threshold and role-language library are both placeholder judgment calls with no real usage data yet** → Mitigation: same posture as `FAIR_USE_CAP`/`CRISIS_RESOURCES` — ship a documented placeholder, monitor real sessions, revisit once beta data exists. Explicitly not blocking this change on getting the thresholds "right" first.
- **[Risk] `audience_keyword_matches[]` could mis-match a role category and quote back irrelevant "audience fit" language** → Mitigation: no-match falls back to omitting the field entirely rather than guessing a nearest category (see Decisions).
- **[Risk] Cost drift** → Mitigation: this change's tasks include checking real M1–M3 production token costs (Anthropic Console) before assuming the spec's <$0.05/session ceiling holds once M4's call is added; see tasks.md.

## Migration Plan

1. Add `session_mining_results` table via Drizzle migration; apply against local Postgres (Docker, port 5434) first.
2. Build and unit-test the extraction call, role-language library, and `mineSession` orchestration entirely against local Postgres/local API key.
3. Wire `checkEntitlement`'s new `getAbuseSignal` check; unit-test both the new denial path and that ordinary users (no off-topic history) are unaffected.
4. **Confirm with Robin before proceeding** — applying the migration against production Postgres (via the `Postgres` service's public proxy, never the internal-only `DATABASE_URL`) and deploying to Railway are rule-5 sensitive steps, and this module as a whole is under the two-instance chat/cli review CLAUDE.md now names it for.
5. Deploy to Railway; verify against a real completed production session (confirm a `session_mining_results` row is written) — per CLAUDE.md's Deployment note, this is part of the module being "done."
6. No rollback data-loss concern: `session_mining_results` is purely additive/derived (rebuildable from `transcript_turns` if ever needed) and `checkEntitlement`'s new check only *adds* a denial condition — reverting the code change alone (no data migration needed) fully restores prior behavior.

## Open Questions

- Real per-session mining cost, measured against actual M1–M3 production usage rather than the spec's original estimate — a tasks.md verification item, not resolved here.
- Whether the mining extraction prompt's static portion clears Haiku 4.5's 4096-token cacheable-prefix minimum, and whether caching is worth adding given the once-per-session (not once-per-turn) call pattern — measured, not assumed, per Decisions above.
- **Flagged to M6, not solved here:** `filler_word_count` has no data source under the current web STT integration. If M6's own spec bullet (a filler-word trend "sourced from M4's filler-word count") is to ship as written, M6 needs either a different signal source or its own decision to drop that specific trend line — this change does not resolve which.
- Exact numeric values for `OFF_TOPIC_THRESHOLD` and the off-topic-session-count denial threshold are placeholders in this change (see config.ts convention) — real values need beta usage data, same posture as `FAIR_USE_CAP` today.
