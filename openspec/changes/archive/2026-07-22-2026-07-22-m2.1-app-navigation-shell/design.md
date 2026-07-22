## Decisions

**Bottom tab bar, not the mockup's top horizontal scroll strip.** The mockup has 7 tabs (Sign up, Conversation, Safety demo, Feedback, Progress & Anchors, Profile, Paywall) because it's a static concept-review page where every screen needs to be reachable at once. The real, signed-in app only has 4 steady-state destinations — Sign up and Paywall are one-time/contextual flows reached by redirect, and Safety demo isn't a real screen at all (it's the crisis card rendering inline inside Conversation). Four items fit a bottom tab bar with no overflow, so the scroll/arrow affordance the mockup needed doesn't apply here. Bottom placement is also the native idiom M10's Expo/React Native build will use (React Navigation's bottom tabs), so web adopts the same shape now instead of a web-only pattern that'd need reconciling later.

**Layout route with `<Outlet/>`, not a wrapper component each page imports.** React Router v7 (already installed) supports nested layout routes natively — `AppShell` renders the header/tab bar once and an `<Outlet/>` for whichever child page is active, rather than every page importing and rendering `<AppShell>` around its own content. Keeps the shell as a single structural point instead of a convention every future page has to remember to follow.

**Tab list as a plain array, not JSX repeated per tab.** `const TABS = [{ to: "/practice", label: "Conversation", icon: ... }, ...]`, rendered via `.map()`. A future module adding a tab (if M9 ever needs one beyond folding into Profile) edits one array entry, not the shell's markup.

**Placeholder pages are real routes now, not commented out.** `FeedbackPage`/`ProgressPage` render a plain "coming soon" state today. Building them as real (if minimal) components rather than leaving the routes absent means the tab bar is complete and correct from this change forward — M5/M6 replace the placeholder's contents later, they don't need to touch the shell or routing at all.

**Sign-up and Paywall stay outside the shell.** Sign-up has no signed-in user yet, so no tab bar makes sense. Paywall is reached by an explicit CTA (`AccountPage.tsx` already links to it) at a moment the user needs to focus on one decision, not browse tabs — adding a tab bar around it would undercut that.

## Risks / Trade-offs

- **This is the first time the web app's CSS gets a shared layout shell.** Existing pages (`SignUpPage`, `AccountPage`, `ConversationPage`) each render their own bare `<main>` today; moving three of them under `AppShell` changes their DOM nesting (now `<AppShell><main>...</main></AppShell>` instead of bare `<main>`) but not their own markup or styles — `main` padding/width rules in `index.css` are unaffected since they still target `main` wherever it sits.
- **Auth-loading flicker.** `authClient.useSession()` has a pending state; the shell must not flash the tab bar (or redirect away) before that resolves. `AccountPage.tsx` already handles this exact case (`isPending` check before redirecting) — the shell reuses the same pattern rather than inventing a new one.
- **Placeholder pages could be mistaken for finished work later.** Mitigation: each placeholder's copy explicitly says "coming soon," and this document + `tasks.md` name them as placeholders in one place, so M5/M6 know on sight that these routes are stubs to fill in, not screens to build from scratch.

## Migration Plan

No database changes. No new env vars. No backend changes at all — this is a `web`-only change. Existing routes `/`, `/account`, `/paywall`, `/practice` keep working; `/feedback` and `/progress` are added as new routes.

## Open Questions

None — this is a small, self-contained UI change with no unresolved product decisions. (If M9's opt-in profile later needs its own tab rather than folding into Profile, that's a decision for M9's own design, not this change.)
