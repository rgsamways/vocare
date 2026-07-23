## Why

M2 shipped a bare-bones, create-only `anchors` table so anchor-aware steering could work end-to-end, and explicitly deferred everything else — edit, archive, revision history, and any way to browse past sessions or see trends — to this module (M2's `design.md`: "Not building M6's anchor CRUD/UI, `anchor_revisions`, or archive management"). Returning users currently have no way to review a past session, see whether they're improving, or manage the goal (anchor) their practice is being measured against. Without this, M0–M5's per-session data (`transcript_turns`, `session_mining_results`, `feedback_reports`) is captured but never surfaced back to the user across time.

## What Changes

- **Session history view**: a list of a user's past sessions, each openable to show its full `transcript_turns` and its `feedback_reports` entry — not just an aggregate trend line (per spec's 2026-07-21 clarification).
- **Trend indicators**, derived by comparing `session_mining_results` across a user's sessions, in the same plain-language, non-judgmental register M5 already uses for single-session feedback:
  - Tradeoff-reasoning / ownership-language / concreteness trend (e.g. "more specific about tradeoffs than 3 sessions ago").
  - Audience-alignment trend, sliced per-anchor via `sessions.anchor_id`, built from `audience_keyword_matches[]` — naturally absent when no anchor is linked.
  - Every trend reports backward movement as plainly as forward movement (spec's 2026-07-22 addition) — no silence-as-implicit-decline.
- **Filler-word trend: dropped, not built.** The spec's bullet assumed a `filler_word_count` signal from M4, but M4 shipped without one — the Web Speech API strips "um"/"uh" before `transcript_turns` ever sees them (confirmed in M3's manual testing), and M4's `design.md` recorded this as flagged-to-M6, unresolved. No replacement signal exists without new STT-layer capture work, which is out of scope here. This change makes the explicit decision to omit the filler-word trend line entirely rather than fabricate or approximate it.
- **Anchor management**: edit (create already exists from M2), archive (using the already-present but unused `anchors.archived_at` column), and dated revisions via a new `anchor_revisions` table rather than silent overwrites — mirroring the Sreditor `anchor.md` + `reflect` pattern so a user can see how their own understanding of the goal shifted over time. Revision history is itself a coaching artifact, per spec, which is why it lives here rather than in account settings.
- New endpoints: list/get past sessions (with joined mining + feedback data), PATCH/archive an anchor, list/append anchor revisions. No existing endpoint's behavior changes; `POST /anchors` (M2, in `conversation.ts`) is untouched.
- Accessibility: trend/history views ship with a non-visual equivalent to any visual trend indicator, per the same requirement M5 already met (no charts/graphs — spec's parking-lot note already decided this module is text-only).

## Capabilities

### New Capabilities
- `anchor-management`: create (existing, M2), edit, archive, and revision-history behavior for anchors, including the new `anchor_revisions` table and its API surface.
- `progress-history`: session history list/detail view and cross-session trend indicators derived from `session_mining_results`/`feedback_reports`, including the explicit decision to omit a filler-word trend.

### Modified Capabilities
(none — `conversation-engine`'s existing anchor-read behavior and `POST /anchors` are unchanged; M6 adds new surfaces, it doesn't change M2's existing requirements)

## Impact

- **Database**: new `anchor_revisions` table (migration required) — **rule-5 sensitive** (database migrations), flagged for confirmation before running against production, per CLAUDE.md.
- **Backend**: new routes for anchor edit/archive/revisions and session history/trends. First write path to `anchors` since M2's create-only form — **two-instance review confirmed for this module** (CLAUDE.md, 2026-07-23), unlike M5's read-only shape.
- **Web**: new UI surfaces — anchor management screen, session history list + detail, trend summary — all text-based, no chart library introduced.
- **No changes** to auth, entitlement, crisis-safety, or mining logic; this module only reads `session_mining_results`/`feedback_reports`/`transcript_turns` and writes to `anchors`/`anchor_revisions`.
