## 1. Shell component

- [x] 1.1 Build `AppShell.tsx`: header (brand mark + wordmark) and bottom `.tabbar`, wrapping child routes via `<Outlet/>`
- [x] 1.2 Auth-aware guard: redirect to `/` if `authClient.useSession()` resolves with no session, matching the same `isPending`-checked pattern already used in `AccountPage.tsx` — no tab bar flash before session state resolves
- [x] 1.3 Tab list as a plain array (`TABS`), rendered via `.map()` with `NavLink` for active-tab styling — not hardcoded per-tab markup

## 2. Placeholder pages

- [x] 2.1 `FeedbackPage.tsx` — plain "coming soon" state, real route, not a stub comment
- [x] 2.2 `ProgressPage.tsx` — plain "coming soon" state, real route

## 3. Routing

- [x] 3.1 Restructure `App.tsx`: `SignUpPage`/`PaywallPage` stay top-level (unwrapped); `AccountPage`, `ConversationPage`, `FeedbackPage`, `ProgressPage` become children of the `AppShell` layout route
- [x] 3.2 Confirm existing routes (`/`, `/account`, `/paywall`, `/practice`) still resolve to the same pages; add `/feedback`, `/progress`

## 4. Styling

- [x] 4.1 Port `.appbar`/`.brand-lockup`/`.wordmark` into `web/src/index.css`, using the mockup's corrected mark (rotated so the apex points at the wordmark, `align-items: center`, no leftover baseline-offset hack)
- [x] 4.2 New `.tabbar`/`.tab`/`.tab.active` styles — sticky-bottom bar, four equal-width flex items, active tab in `--accent`

## 5. Verification

- [x] 5.1 `npm run lint|typecheck|test|build -w @vocare/web` — all clean (2 test files / 2 tests passing, unaffected by the routing change; production build succeeds)
- [ ] 5.2 Manual: load the app in a real browser, confirm the tab bar renders once signed in, all four tabs navigate correctly, active-tab styling matches the current route, and the bar does not flash/appear before session state resolves — **not yet done by either instance; flagging rather than claiming it.**
- [ ] 5.3 Manual: confirm signed-out visits to `/account`, `/practice`, `/feedback`, `/progress` redirect to `/` without a flash of shell content first

**Note:** `AccountPage.tsx` already had its own signed-out redirect effect (from M1) that's now redundant with `AppShell`'s guard — both target the same route, so it's harmless, but left as-is rather than removed, since deduplicating it wasn't part of what was asked here.
