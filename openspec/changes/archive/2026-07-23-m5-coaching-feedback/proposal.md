## Why

M4 (post-session mining) now produces a `session_mining_results` row for every completed session, but nothing reads it back to a user — the app's own placeholder `FeedbackPage` still says "Coming soon." A person can finish a practice conversation and get nothing back for it, which is the whole point of practicing undercut at the last step. M5 is the first module to actually surface any of M4's signal, turning it into the plain-language, non-judgmental coaching notes the product's core promise depends on.

## What Changes

- New `feedback_reports` table (spec Section 3): one row per completed session, holding a deterministic set of coaching notes derived from that session's `session_mining_results` row.
- New note-generation logic (`backend/src/feedback/`): a pure, template-based mapping from mining fields to plain-language notes — **not** a new LLM call. Each note quotes the user's actual words where the mining record has one (`quantifiedImpactExamples[]`, `audienceKeywordMatches[]`), per the spec's own instruction to ground claims in real transcript lines rather than assert them abstractly.
- Generation is chained onto the existing M4 mining pass (same async seam, right after `session_mining_results` is written) — no new trigger point, no polling infrastructure.
- New route `GET /sessions/:id/feedback` — returns that session's report, or an explicit "pending" state if mining hasn't finished yet (a real race, since mining is async).
- New route `GET /feedback/latest` — returns the most recently completed session's report, for the tab-bar entry point when there's no specific session in context (full history browsing is M6's job, not built here).
- `FeedbackPage` becomes real: renders coaching notes as accessible, semantic HTML with proper ARIA labeling, handles the pending/no-report/no-audience-match states as normal paths, and never renders `topicRelevanceScore` or any numeric score.
- `ConversationPage`'s `handleEnd` navigates to the just-ended session's feedback report instead of `/account`.
- New route `/feedback/:sessionId` alongside the existing `/feedback`.

**Explicitly out of scope:** the personal practice-word dictionary extension (spec Section 24, parked until M5 exists — not built now); any trend/history view across sessions (M6); any change to M4's extraction logic or schema.

## Capabilities

### New Capabilities
- `coaching-feedback`: turning a session's mining result into a stored, user-facing feedback report and rendering it accessibly.

### Modified Capabilities
(none — this change only reads `session-mining`'s existing output; no requirement in that capability changes)

## Impact

- `backend/src/db/schema.ts`: new `feedback_reports` table + migration — **rule-5 sensitive**, flagged and confirmed with Robin before applying/deploying, per CLAUDE.md's Deployment note. Per CLAUDE.md's Development Process note (confirmed 2026-07-22), this module is single-instance, not two-instance — it only reads M4's already-produced rows and doesn't touch `tier2a`/`tier2b`, mining signal, or entitlement/abuse logic.
- New `backend/src/feedback/` module: note-generation logic and its unit tests.
- `backend/src/mining/mine-session.ts` (or wherever M4's orchestration lives): gains a call into the new feedback-generation logic after the mining insert succeeds.
- `backend/src/routes/`: new feedback routes (exact file — new `feedback.ts` vs. extending `conversation.ts` — is design.md's call).
- `web/src/pages/FeedbackPage.tsx`: replaced with a real, accessible implementation.
- `web/src/pages/ConversationPage.tsx`: `handleEnd`'s post-end navigation target changes.
- `web/src/App.tsx`: new `/feedback/:sessionId` route.
- No changes to M2/M3's live conversation code, M4's extraction logic, or crisis-safety logic.
