## Why

M1 and M2 each built their own screens (sign-up/paywall/account, conversation) with no shared shell connecting them — every page renders a bare `<main>`, and nothing in the M0–M11 plan ever scoped the navigation tying screens into one app. Real gap, not a design choice: caught 2026-07-22 while reviewing `mockups/interface-v1.html`'s tab strip against the live site and finding the live site has no equivalent at all. Logged in `FIXLIST.md`; this change closes it. Not rule-5 sensitive (no auth/payment/migration/crisis/anonymization logic changes) — single-instance build, per CLAUDE.md's carve-out for straightforward UI modules.

## What Changes

- A real app shell (header with brand mark + wordmark, bottom tab bar) wrapping the four persistent, signed-in destinations: Conversation, Feedback, Progress & Anchors, Profile.
- Sign-up stays outside the shell (pre-auth, no tabs). Paywall stays reachable by redirect/CTA, not as a tab — matches how `AccountPage.tsx` already links to it.
- Two new placeholder pages, `FeedbackPage` and `ProgressPage`, each a plain "coming soon" state — M5 and M6 haven't been built yet, but their tabs need to exist now so the nav is complete.
- Tab list is a plain data array the shell renders from (no hardcoded per-tab markup), so a later module can add an entry without touching the shell's structure.
- Brand mark in the header matches `mockups/interface-v1.html`'s current, corrected version (rotated so the arc's apex points at the wordmark, vertically centered against it) — the real app's CSS never had this mark at all before this change.

**Explicitly out of scope:** the mobile (Expo) nav — that's M10's own build, though this change's bottom-tab shape is chosen partly so M10 can mirror it later rather than inventing a different pattern. Also out of scope: any grouping/overflow "More" menu — not needed at 4 tabs, revisit only if a future module pushes past ~5.

## Capabilities

### New Capabilities
- `app-navigation-shell`: the auth-aware layout (header + bottom tab bar) wrapping the four persistent pages, plus the two new placeholder pages it makes reachable.

### Modified Capabilities
(none — no existing capability's behavior changes, only how its page is reached)

## Impact

- New `web/src/components/AppShell.tsx`, wrapping the existing `AccountPage`/`ConversationPage` and two new placeholder pages as nested routes via React Router's `<Outlet/>`.
- `web/src/App.tsx` restructured: `SignUpPage` (and the magic-link callback) stay top-level/unwrapped; `AccountPage`, `ConversationPage`, `FeedbackPage`, `ProgressPage` become children of the shell layout route. `PaywallPage` stays top-level/unwrapped (reached by redirect, not a tab).
- New CSS in `web/src/index.css`: `.appbar`/`.brand-lockup`/`.wordmark` (ported from the mockup, corrected mark) and a new `.tabbar` bottom-nav treatment (mockup has no equivalent to port — the mockup's own top scrolling strip is explicitly not being carried over).
- No backend changes, no schema changes, no changes to M1's entitlement logic or M2's crisis-safety behavior — this change only touches how existing pages are reached.
