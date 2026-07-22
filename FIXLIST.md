# Vocare Fix List

A flat, non-narrative punch list of bugs/gaps found after the fact — outside a formal build session, or spanning modules a single `tasks.md` wouldn't cover. Not for deferred product decisions (those go in the spec's Section 24 Parking Lot) and not for the story of *how* something was found (that's `journal/`). Just: what's wrong, where, status.

Format: `- [ ]`/`- [x]`, module(s) touched, one line on what's wrong, date found/resolved.

## Open

- [ ] **M1** — Signup screen copy (DOB privacy line, AI-disclosure checkbox text) reads at a higher verbosity/comprehension level than plain-language guidance would recommend. Not wrong, just risks being skimmed past or misread by some users. Reword in a future pass — not urgent, flagged 2026-07-22. Touches `web/src/pages/SignUpPage.tsx`.
- [ ] **M1 — action item, not a bug.** Robin wants to give a specific friend unlimited Vocare use. Mechanism: once the friend signs up through the real magic-link flow, manually set his `entitlement_status` in production Postgres — no code change needed. Note: M1's fair-use velocity cap still applies regardless of paid status by design, so "unlimited" is bounded by that cap unless he's also given the crisis-style exemption. **This is a production auth/entitlement change (rule 5) — requires Robin's explicit go before executing, not just this note.** Flagged 2026-07-22.

- [ ] **M1** — `SignUpPage.tsx` calls `navigate("/account")` directly in the render body (`if (session) { navigate(...) }`) instead of inside a `useEffect`. Same anti-pattern that surfaced as a real "Cannot update a component while rendering a different component" warning in the new `AppShell.tsx` (M2.1) once `AppShell` was fixed to use `useEffect` properly instead. `SignUpPage.tsx`'s copy wasn't touched — out of scope for the M2.1 change that found it — but it's the same bug, just not yet observed to warn in practice. Flagged 2026-07-22.

## Resolved

- [x] **M1** — `mockups/interface-v1.html`'s signup screen had drifted from the real built app: showed one bundled checkbox ("I'm 16 or older...") where the real `SignUpPage.tsx` already used a separate DOB field (age, computed/enforced server-side) plus a distinct AI-disclosure checkbox. Fixed 2026-07-22 by matching the mockup to the live code exactly — including field order (Email → DOB → Country → fine print → checkbox), which needed a second pass after the first fix reordered fields and invented a line not present in the real code.
