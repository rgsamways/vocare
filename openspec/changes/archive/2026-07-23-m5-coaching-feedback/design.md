## Context

M4 produces `session_mining_results`, one row per completed session, written by a fire-and-forget call chained off `POST /sessions/:id/end` (`mineSession` in `backend/src/mining/mine-session.ts`). Nothing reads that row back today — `FeedbackPage.tsx` is still M2.1's "Coming soon" placeholder, and `ConversationPage`'s `handleEnd` navigates to `/account` after ending a session. This module is the first to expose any mining signal to a real user, and the first user-facing surface in the codebase with an explicit no-score constraint baked into its own spec bullet.

Existing patterns this design reuses rather than reinvents:
- `mine-session.ts`'s single-seam orchestration — extended in place, not duplicated.
- `config.ts`'s placeholder-content convention (`CRISIS_RESOURCES`, `ROLE_LANGUAGE_REFERENCE`) — the note-template catalog lands here the same way, flagged pending real tone/usage review.
- `session_mining_results`' natural-key convention (`sessionId` as the primary key itself, not a separate `id`) — reused for `feedback_reports` for the identical one-row-per-session reason.
- `AccountPage`/`ConversationPage`'s existing `loadOwnedSession`-style ownership check — reused for the new feedback routes rather than inventing a new auth pattern.

## Goals / Non-Goals

**Goals:**
- Every completed session with a mining result produces exactly one `feedback_reports` row, generated deterministically (no new LLM call) from that mining result.
- Notes quote the user's real words wherever the mining record has one (`quantifiedImpactExamples[]`, `audienceKeywordMatches[]`), never inventing or paraphrasing a quote.
- `topicRelevanceScore` is structurally excluded from the note-generation function's input, not just omitted from the UI — a leak requires changing the function's own signature, not just a rendering mistake.
- A session with no anchor / no confident role match (the normal case today, per the role-language library's current coverage) renders a complete, ungapped report — no "we couldn't find X" framing.
- `FeedbackPage` is semantic and screen-reader-navigable: a heading, a list of notes, no meaning conveyed by color/layout alone.

**Non-Goals:**
- No new Anthropic API call — this entire module is a pure transform over already-extracted structured fields.
- No trend/history view across sessions, no session list (M6).
- No personal practice-word dictionary (spec Section 24, parked until this module exists).
- No change to `session_mining_results`' schema, extraction prompt, or `checkEntitlement` wiring — this change is read-only against M4's output.
- No sentiment- or tech-domain-mention-based notes in this pass — see Decisions below on why the note catalog is narrower than the full mining schema.

## Decisions

**Note generation: a pure, deterministic template function, not an LLM call.** `session_mining_results`' fields are already structured booleans/enums/arrays — turning `ownershipLanguagePresent: true` into "You described your own role in what happened clearly" is a lookup, not a generation task. A template function is free to run (no added Anthropic cost on top of M4's), can't drift into judgmental or scored phrasing under a bad prompt, and is fully unit-testable against known mining inputs. `buildFeedbackReport(result: SessionMiningResult): CoachingNote[]` in new `backend/src/feedback/notes.ts` takes the mining row and returns a note array — it does not take `topicRelevanceScore` as an input at all (the function's parameter type omits it), so leaking it into a note isn't a possible bug, only a possible *type change* that would need its own deliberate decision.
- *Alternative considered:* a second Haiku 4.5 call that phrases the mining fields into prose. Rejected — no clear benefit over a template (the target phrasing in the spec's own example is already simple and mechanical to construct from booleans), it would add per-session cost and latency for no quality gain, and it reopens exactly the "could the model editorialize a score in anyway" risk the whole no-score requirement exists to close off.

**Note catalog, v1: ownership language, tradeoff reasoning, outcome mention, clarity, quantified-impact quotes, audience-keyword quotes. Sentiment and tech-domain-mentions excluded from this pass.** The spec's own M5 bullets only ask for ownership/tradeoff/quoted-audience-language coverage; `clarity`/`outcomeMentioned` map cleanly onto the same developmental framing. `sentiment` risks reading as the app commenting on the user's emotional state rather than their described work ("your tone was negative" lands closer to unsolicited pop-psychology than coaching) — held out pending a real tone/copy pass, not built silently. `techDomainMentions[]` is purely reflective (just listing what was mentioned) and carries little downstream risk, but isn't asked for by the spec bullets either — left out to keep this change's scope matched to what was actually requested, not because it's unsafe. Both are flagged in Open Questions below rather than dropped without a trace.
- Exact note copy lands in code as an explicitly flagged placeholder catalog (same convention as `CRISIS_RESOURCES`/`PERSONA_COMBINATIONS`), pending real tone review once there's usage to react to.

**No-match handling: omit the category, never state an absence.** When `audienceKeywordMatches` is `null` (no anchor, or no confident role match — the normal case for most sessions today per M4's starter role-language library), the audience-keyword note is simply not included in the report. No "we didn't find role-specific language" note is generated — that would be the same disguised-negative-signal problem `journal`/spec discussions elsewhere in this project already flag for trend reporting, just arriving one module early. Same treatment for `quantifiedImpactExamples: []` and `growthSignals: []` (not currently in the v1 catalog per above, noted for symmetry) — empty means "nothing generated for this category," not "nothing to say."

**Trigger: extend `mineSession`'s existing seam, immediately after the mining insert succeeds.** `mineSession` already does one DB write per completed session; it now does a second, synchronous, in-process write (`buildFeedbackReport` + insert into `feedback_reports`) right after the first succeeds, inside the same try/catch. No new async infrastructure, no new trigger point, and the report is ready by the time the mining row exists — the two are written moments apart in the same call, not on separate schedules.
- *Alternative considered:* generate-on-read, computed lazily the first time `GET /sessions/:id/feedback` is called. Rejected — it's the same deterministic function either way, but generate-on-write means the read path is a trivial `SELECT`, keeps `feedback_reports` genuinely immutable/auditable (`generatedAt` means something fixed), and avoids a lazy-generation race between two concurrent first-reads.

**Storage: `feedback_reports` keyed by `sessionId` (the primary key itself), not the spec's literal `id (pk), session_id (fk)`.** Same deviation `session_mining_results` already made from the spec's generic shape, for the identical reason: this is a strict one-row-per-session table, and a natural key enforces that constraint directly rather than needing a separate uniqueness check. `coachingNotes` stored as `jsonb`, an array of `{ kind: string, note: string, quote?: string }` objects — `kind` is the template category (e.g. `"ownership"`, `"audience_keyword"`), used by nothing yet but useful for any future per-category logic (e.g. M6 wanting to trend one category) without a schema change.

**Read path: two routes, both auth-gated and ownership-checked like the existing session routes.** `GET /sessions/:id/feedback` reuses `conversation.ts`'s `loadOwnedSession` pattern (404 if the session doesn't exist or isn't the caller's) and returns `{ status: "pending" }` when the session is `complete` but no `feedback_reports` row exists yet (mining is async — this is a real, expected race, not an error state) or `{ status: "ready", report }` once it does. `GET /feedback/latest` finds the caller's most recently completed session and delegates to the same lookup, returning `{ status: "none" }` if the user has never completed a session — this is the tab-bar entry point's data source; a full session-picker is M6's job.
- Both routes live in a new `backend/src/routes/feedback.ts`, registered in `app.ts` alongside the existing route plugins, rather than growing `conversation.ts` further — mining/feedback reads are a distinct concern from the live conversation routes that file already holds.

**Frontend: no polling loop for the pending state.** A "pending" response renders a plain, accessible message ("Your feedback is still being prepared — this usually takes a few seconds.") with a manual, keyboard-reachable "Check again" button, rather than an automatic retry interval. Mining is typically fast enough that most users won't see this state at all by the time they navigate from `ConversationPage`; a polling loop would be unobservable complexity for a case that's usually instantaneous.

## Risks / Trade-offs

- **[Risk] The v1 note catalog (6 categories) could feel thin next to the full mining schema (8+ fields)** → Mitigation: deliberate, not accidental — see Decisions on sentiment/tech-domain-mentions. Flagged in Open Questions for a follow-up pass once there's real session output to react to, not silently dropped.
- **[Risk] A session with none of the 6 categories present (e.g. a very short session) could produce an empty or near-empty report** → Mitigation: `buildFeedbackReport` always includes a fixed, generic closing note ("Thanks for practicing — the more you do this, the more there is to notice.") so the report is never literally empty; real content is additive on top of that floor.
- **[Risk] Placeholder note copy ships without real user reaction to test tone against** → Mitigation: same posture as every other placeholder in this codebase (`CRISIS_RESOURCES`, persona copy) — explicitly flagged in code comments, revisited once there's real usage.
- **[Risk] `feedback_reports` migration touches production Postgres** → Mitigation: rule-5 sensitive per CLAUDE.md — applied against local Postgres first, confirmed with Robin before the production migration/deploy step, same process every module since M2's deploy-gap correction has followed.

## Migration Plan

1. Add `feedback_reports` table via Drizzle migration; apply against local Postgres (Docker, port 5434) first.
2. Build `backend/src/feedback/notes.ts` (the template catalog + `buildFeedbackReport`) with unit tests against known `session_mining_results`-shaped inputs, including the no-anchor/no-match and near-empty-session cases.
3. Extend `mineSession` to call `buildFeedbackReport` and insert into `feedback_reports` after the existing mining insert succeeds; extend its existing tests to assert a `feedback_reports` row is written alongside `session_mining_results`.
4. Build `backend/src/routes/feedback.ts` (`GET /sessions/:id/feedback`, `GET /feedback/latest`) and register it in `app.ts`.
5. Build the real `FeedbackPage.tsx` (semantic HTML, ARIA), add the `/feedback/:sessionId` route in `App.tsx`, and change `ConversationPage.handleEnd`'s post-end navigation target.
6. **Confirm with Robin before proceeding** — applying the migration against production Postgres (via the `Postgres` service's public proxy, never the internal-only `DATABASE_URL`) and deploying to Railway are rule-5 sensitive steps.
7. Deploy to Railway; verify against a real completed production session (confirm a `feedback_reports` row is written and `/feedback/latest` returns it) — per CLAUDE.md's Deployment note, this is part of the module being "done."
8. No rollback data-loss concern: `feedback_reports` is purely derived from `session_mining_results` (rebuildable by re-running `buildFeedbackReport` over existing mining rows if the template catalog ever changes) — reverting the code change alone fully restores prior (placeholder-page) behavior.

## Open Questions

- Whether `sentiment` and `techDomainMentions[]` should ever surface as notes, and in what framing — deliberately excluded from this change's v1 catalog (see Decisions), not resolved here. Revisit once there's real session output and, ideally, real user reaction to the v1 catalog's tone.
- Exact note copy for each of the 6 v1 categories is a placeholder pending tone review, same posture as `CRISIS_RESOURCES`/persona copy elsewhere in this codebase — not finalized by this design doc.
- Whether `GET /feedback/latest` is still the right shape once M6 exists (which will want a per-session picker, not just "latest") — likely superseded or reused as a sub-case by M6's own routes; not resolved here, flagged for that module.
