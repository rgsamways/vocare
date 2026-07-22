## Why

Vocare has no way yet to identify a returning user, gate access to the free/paid tiers, or take payment — every module after M0 (the conversation engine, mining, feedback, progress) needs an authenticated, entitlement-checked user to attach data to. M1 builds that foundation: passwordless sign-in, a $29 one-time-payment unlock, the free-tier and fair-use limits that bound cost/abuse, and the account-management surface (profile screen, deletion) that data-privacy and platform-policy commitments elsewhere in the spec depend on.

## What Changes

- Better Auth magic-link email sign-in — no passwords anywhere, no OAuth for launch (decided 2026-07-21; revisit only with real funnel data).
- 30-day sliding-window session (web cookie / Expo-equivalent secure token), refreshed on activity.
- Age gate at signup: 13+ absolute floor (Claude API terms), 16+ recommended target — **exact copy is a placeholder pending legal review, not finalized by this change.**
- Light country capture at signup (select/detect, not a real form field) — feeds M2's crisis-resource localization; not read anywhere else in this change.
- `users` table with an entitlement flag, plus Stripe Checkout integration (web only): $29 **USD** one-time (currency decided 2026-07-22), `mode: "payment"` → webhook flips `entitlement_status`.
- Webhook handler reads the **raw, unparsed** request body (required for Stripe signature verification) and is idempotent by `event.id`.
- Dispute/chargeback handling: a `charge.dispute.created` handler revokes `entitlement_status` back to unpaid — the webhook design gap identified in the spec's drift audit.
- No-refund policy: all sales final, stated in the ToS (exact wording flagged for legal review, not drafted here). Distinct from the dispute handler above.
- Entitlement checks are never client-trusted — every session start re-verifies `entitlement_status` against an authenticated server call. Android APKs are decompilable; a cached "paid" flag is not a security boundary.
- Fair-use velocity cap: an undisclosed rolling-window rate limit (max sessions/24h, max sessions/30-day) enforced at the same server-side entitlement check. **Threshold numbers are placeholders pending real beta usage data, not finalized by this change.** User-facing behavior on trip is a plain in-app message, worded to stay vague about reset timing (the cap spans two windows, not one). Crisis-flagged sessions (`sessions.crisis_flagged`, set by M2) are exempt.
- 3-free-session gate: decrements at session *completion*, not session start (an abandoned session doesn't cost a try). Crisis-flagged sessions are also exempt from this count.
- Minimal profile/account screen: email, entitlement status ("2 free sessions left" / "unlocked $29 [date]"), and the account-deletion trigger. Anchor creation/editing is out of scope here (lives in M6).
- Account deletion: a real cascade-delete across `users`, `sessions`, `transcript_turns`, `session_mining_results`, `feedback_reports`, `tier1_profiles`, `anchors`, `anchor_revisions`, **and Better Auth's own session/verification-token tables** (the exact names its Drizzle adapter generates — e.g. `session`, `verification`, `account` — are not guessed here; `cli` confirms them against the actual generated schema before implementing the deletion task). **The Tier 2b recomputation-vs-disclosure approach for already-aggregated anchor data is an open question this change flags but does not resolve** (per spec Section 3's note, needs a decision as part of this task, not deferred silently).
- Android note: the mobile app never initiates a purchase, only checks `entitlement_status` server-side — purchase happens on web. Consumption-only, per Play policy.

## Capabilities

### New Capabilities
- `magic-link-auth`: Better Auth passwordless email sign-in, 30-day sliding session, age gate, and country capture at signup.
- `stripe-billing`: Stripe Checkout ($29 one-time) integration, webhook handling (grant + dispute revocation), no-refund policy.
- `session-entitlement`: server-side-only entitlement verification, the 3-free-session gate, and the undisclosed fair-use velocity cap.
- `account-management`: the profile/account screen and full cascade-delete on account deletion.

### Modified Capabilities
(none — no existing specs predate this change)

## Impact

- New `users` table/collection with entitlement fields; new session storage per Better Auth's schema requirements.
- New backend routes: magic-link request/verify, Stripe Checkout session creation, Stripe webhook endpoint (raw-body middleware ordering matters — must run before any JSON body parser touches that route), account deletion, profile read.
- New Stripe account configuration: a recognizable statement descriptor (product name, not a generic business name) set before first live transaction, per the spec's dispute-prevention note.
- New web UI: signup/magic-link screens, paywall screen, minimal profile screen — per CLAUDE.md's note, these should follow `mockups/interface-v1.html` and `mockups/brand-v1.html` as the settled reference design, not a fresh design pass.
- No mobile UI in this change — M1's Android surface is limited to the entitlement-check call itself; the app shell arrives in M10.
- Touches M2 only at the boundary: this change defines `sessions.crisis_flagged` as an exemption input to the velocity cap and free-session count, but does not implement the crisis-detection logic that sets it (M2's scope).
- Legal/compliance dependency: age-gate copy, ToS no-refund wording, and velocity-cap thresholds are explicitly left as placeholders in this change, flagged for the lawyer already recommended elsewhere in the spec (PIPEDA, content licensing) rather than invented here.
