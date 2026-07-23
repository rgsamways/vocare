## Context

M2 shipped a minimal `anchors` table (create-only, via `POST /anchors` in `conversation.ts`) purely so anchor-aware steering could be exercised end-to-end, and explicitly deferred edit/archive/revision history to this module. `anchors.archived_at` exists but nothing sets it. `anchor_revisions` doesn't exist as a table at all. M4 shipped `session_mining_results` (one row per session) and flagged, unresolved, that `filler_word_count` has no data source. M5 shipped `feedback_reports` (one row per session). No endpoint currently lets a user list or reread their own past sessions, and no endpoint computes a trend across them.

This is the first module since M2 to write to `anchors`, and the first `anchor_revisions` migration ever — per CLAUDE.md's 2026-07-23 confirmation, this module is two-instance (chat proposes/applies via OpenSpec, an independent instance grades from the persisted files).

**Correction, 2026-07-23, found during live production testing:** `mockups/interface-v1.html` already contains a fully-designed `#progress` screen (styled trend rows, `<details>`-based expandable session history with a real per-session topic line, `.anchor-card`/`.anchor-revision.earned` styling) that predates this module, the same way M2's conversation-screen mockup was settled before that module was scoped. This was missed when writing this design — the Web UI tasks (groups 5/6) were scoped generically instead of pointing at it, so the first pass reused the feedback page's generic `.feedback-note`/`.btn secondary` styling and showed only a bare date per session row, with no way to tell sessions apart at a glance. Two follow-up decisions, made now rather than left ambiguous:
- **Session topic label:** derived from the first user `transcript_turns` row's content (truncated), not a new stored title or LLM call — same "quote the user's real words" posture M5 already uses for coaching notes, and zero added cost. Added to `GET /sessions`'s response.
- **Visual parity:** `ProgressPage.tsx` is restyled to match the mockup's `#progress` screen (trend-line rows, native `<details>` history rows, anchor-card/revision-callout styling), porting the mockup's CSS into `web/src/index.css` — including adding `--warm`/`--warm-soft` theme variables (light + dark), which don't exist yet in that file but do in the mockup. The mockup doesn't show a full multi-revision history view (only the single most-recent change, inline) — that affordance is new and follows the rest of the app's existing visual language rather than the mockup exactly, per the same "authoritative for what it does show" posture M2 used.

**Second correction, 2026-07-23, found while explaining anchors to Robin:** `ConversationPage.tsx`'s session-start "anchor" toggle only ever calls `POST /anchors` to create a brand-new anchor — there was never a way to link a new session to an anchor that already exists. Every session with the toggle checked created another anchor rather than reusing one, which is also why stray one-off anchors like "Mobile app/platform development" existed alongside the intended test anchor. Since M6 is "where anchor management lives" and just built `GET /anchors`, closing this gap belongs here rather than a later module — Robin's call, 2026-07-23. Fix: session start offers a choice among the user's existing active anchors (fetched via `GET /anchors`, archived ones excluded — an archived anchor is retired, not a session target) plus "create new" (existing inline form) and "none," rather than only ever creating new.

## Goals / Non-Goals

**Goals:**
- Anchor edit and archive, with every field edit captured as an append-only `anchor_revisions` row before the live row changes, so a user's shifting understanding of their goal is visible over time.
- A session history list + per-session detail view reading `transcript_turns`/`session_mining_results`/`feedback_reports` as they already exist — no new mining or feedback logic.
- Two trend indicators, computed on-demand (not materialized): a general tradeoff-reasoning trend across all of a user's completed sessions, and a per-anchor audience-alignment trend across sessions linked to that anchor. Both report backward movement in the same plain register as forward movement.
- An explicit, documented decision to drop the spec's filler-word trend bullet rather than fabricate a signal that doesn't exist.

**Non-Goals:**
- No charts/graphs — spec's own parking-lot note already decided this module is 100% text.
- No new mining signals, no changes to M4's `mineSession` or M5's `generateFeedback` — this module only reads their output.
- No personal-practice-word dictionary (Section 24) — explicitly out of scope for this change, not requested.
- No trend for `ownershipLanguagePresent`, `clarity`, `sentiment`, or other `session_mining_results` columns beyond the two the spec explicitly asks for — not inventing additional trend types.
- No materialized/cached trend table — session volume per user is low (interview practice, not high-frequency), so on-demand computation avoids stale-cache risk for negligible cost.

## Decisions

**`anchor_revisions` stores the pre-edit snapshot, not the post-edit state.** Each successful `PATCH /anchors/:id` field edit first inserts a row capturing the anchor's *current* (about-to-be-overwritten) `label`/`target_role`/`target_industry`/`job_description_text`/`company` plus a `revised_at` timestamp, then applies the update to the live `anchors` row. The live row is always "now"; `anchor_revisions` is the append-only history of every "before." *Alternative considered:* storing the post-edit state instead — rejected because it would duplicate the live row's current values at the moment of the last edit, whereas storing the pre-edit snapshot means the live row is never redundant with its own history.
- Archiving (`archived_at`) is a state toggle, not a "revision" of goal understanding, so it does not write an `anchor_revisions` row.
- The spec's example diff sentence ("narrowed from 'any backend role' to 'backend infra, fintech'") is generated by the web client diffing consecutive snapshots (oldest revision → next revision → ... → live row), not stored as free text server-side. Keeps the write path a plain snapshot insert with no derived-text generation to keep in sync.

**New routes split into `anchors.ts` and `progress.ts`, not added to `conversation.ts`.** Matches the existing one-file-per-concern convention (`conversation.ts`, `feedback.ts`, `account.ts`) registered in `app.ts`. `POST /anchors` (M2) stays in `conversation.ts` untouched; the new `PATCH /anchors/:id`, `POST /anchors/:id/archive`, `POST /anchors/:id/unarchive`, `GET /anchors`, `GET /anchors/:id/revisions` land in `anchors.ts`. `GET /sessions`, `GET /sessions/:id`, `GET /progress/trends` land in `progress.ts`.

**Ownership checks reuse the `loadOwnedAnchor` pattern from `conversation.ts`.** Every new anchor/session read or write re-verifies `userId` match server-side (not just filtering by the authenticated user's own list) — same posture already established there.

**Filler-word trend: dropped.** M4's `design.md` recorded this as an open question for M6 to resolve, not a bug to fix. No signal exists under the current Web Speech API integration (it strips disfluencies before `transcript_turns` ever sees them), and building an alternative capture path is a voice-pipeline change, not a progress-view change — out of scope here. Decision recorded once, here, so it isn't re-litigated per session.

**Trend comparison window: fixed at "3 completed sessions back," omitted entirely below that history depth.** The spec's own trend examples all say "3 sessions ago" — implemented literally as comparing the most recent completed session against the completed session exactly 3 before it in the relevant ordered scope (all completed sessions for the general trend; same-anchor completed sessions for the audience trend). If fewer than 4 qualifying sessions exist, the trend is omitted from the response entirely (not shown as "not enough data yet" copy, not compared against session 1) — same "don't fabricate a signal" posture as the filler-word decision. *Alternative considered:* comparing against the earliest available session when history is short — rejected because it silently changes what "3 sessions ago" means without saying so, which risks the same disguised-judgment failure mode the spec's 2026-07-22 backward-movement addition was written to avoid.
- General trend signal: `tradeoff_reasoning_present` boolean, compared present-then/present-now. Reported both directions ("included tradeoff reasoning this session, which you hadn't 3 sessions ago" / the reverse).
- Audience-alignment trend signal: `audience_keyword_matches[]` array length, compared 3-sessions-back vs now, scoped to sessions sharing the same `anchor_id`. Absent when the current session has no linked anchor, or when `audience_keyword_matches` is null on either side (no `target_role` set at that time) — matches M4's existing "omit rather than guess" posture for that column.

**Session history scope: only `status: "complete"` sessions.** In-progress/abandoned sessions have no `session_mining_results`/`feedback_reports` row (M4/M5 both key off session completion), so listing them would produce a broken detail view. `GET /sessions` and `GET /sessions/:id` filter to completed sessions only.

## Risks / Trade-offs

- **[Risk] `PATCH /anchors/:id` is the first write path to a table M2 flagged as sensitive-adjacent** → Mitigation: two-instance review (confirmed 2026-07-23), ownership check on every request, revision snapshot written in the same transaction as the update so a partial failure can't silently lose history.
- **[Risk] Migration adds a new table with no rollback data-loss concern, but is still a real production migration** → Mitigation: purely additive (`anchor_revisions` has no foreign keys pointing *into* it from elsewhere), so rollback is drop-table-only if ever needed; flagged under rule 5 before running against production Postgres.
- **[Risk] On-demand trend computation could get slow if a user's session count grows very large** → Mitigation: not a concern at current beta scale (interview practice, not high-frequency usage); revisit with a materialized/cached approach only if real usage data shows otherwise — not solving a problem that doesn't exist yet.
- **[Risk] Dropping the filler-word trend could read as quietly reneging on a spec commitment** → Mitigation: recorded explicitly here and in the proposal, not silently omitted from the code with no trace.

## Migration Plan

1. `drizzle-kit generate` for `anchor_revisions` (id, anchor_id FK, label, target_role, target_industry, job_description_text, company, revised_at).
2. Confirm with Robin before proceeding — running the migration against production Postgres (via the `Postgres` service's public proxy) and deploying to Railway are rule-5 sensitive steps, same as every prior module's migration.
3. Deploy to Railway; verify against a real anchor edit in production (confirm a row lands in `anchor_revisions` and the live `anchors` row updates) — per CLAUDE.md's Deployment note, this is part of the module being "done."
4. No data backfill needed — `anchor_revisions` starts empty; existing anchors simply have no history prior to their first M6-era edit.

## Open Questions

- None outstanding — the filler-word gap M4 flagged is resolved above (dropped), and the trend-window question is resolved above (fixed 3-back, omit below that depth). Both were explicit decisions this design needed to make, not deferred further.
