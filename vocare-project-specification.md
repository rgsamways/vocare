# Project Specification — Vocare

### An AI-Conversational Interview Practice App with Tiered, Consent-Walled Data Monetization

**Status:** Pre-build planning document — verified pass (tech claims checked against current sources, see Section 8)
**Owner:** Robin Samways
**Spec methodology:** OpenSpec change proposals, one per module below
**Version:** 3.0 — project renamed from "Reps" to **Vocare**. Every occurrence of the old working name has been replaced throughout this document. The name is final — this is not a placeholder.

> **Naming history (for the record, not a current concern):** this project was called "Reps" during planning. Section 18 found that name heavily saturated in app stores already (multiple actively-published fitness/gym-tracking apps, one with 2M+ users) — a real discoverability problem, not just an aesthetic one. The project was renamed to **Vocare** as a result, and `vocare.ca` is confirmed available. **The name is Vocare. It is not, and will not be referred to as, "Reps" anywhere going forward.**

---

## 1. Product Thesis (one paragraph, for anchor doc)

People are being screened out of jobs by AI interviewers optimizing for shallow, mechanical signals (syntax trivia, "why A over B") instead of real signal (what someone has actually built, how they think about tradeoffs, how their work has evolved). Vocare is a cheap, unlimited-use practice tool where a person just talks — what they've done, what they're doing, what they want next — with no trivia and no scoring pressure in the moment. Feedback and any downstream value happen *after* the conversation, never during it. The business model is a $10 lifetime fee (not a subscription) plus an optional, strictly consent-gated data layer on the back end that only monetizes what people explicitly allow.

---

## 2. Tech Stack

Chosen to match tooling you already run (Farpost, Sreditor) so there's no new platform-learning cost, and to keep infra costs near-zero at low-to-mid user counts.

| Layer | Choice | Why |
|---|---|---|
| Spec/change management | **OpenSpec** | Already your workflow (Farpost, Sreditor) — spec-first, one change proposal per module |
| Backend language/runtime | **Node.js + TypeScript** | Matches Sreditor stack; single language across backend/frontend/mobile-web |
| Backend framework | **Fastify** | Lighter than Express, good TypeScript support, low overhead for a solo-maintained API |
| Database | **PostgreSQL** (switched from MongoDB — see correction below) | **Correction, made deliberately rather than inherited by analogy:** the original choice of MongoDB was reasoned by "matches Farpost," not by fit for Vocare's own data. Vocare's model is genuinely relational — `sessions` belong to `users`, `transcript_turns` belong to `sessions` with strict ordering, and the highest-value queries (Tier 2b aggregate rollups, M6's progress-over-time trends) are exactly what Postgres's joins, indexes, and window functions are built for. The one semi-structured piece (`session_mining_results.extracted_signals`) is well-served by Postgres's `JSONB` column type, so no flexibility is lost where it's actually needed. Railway provisions Postgres and MongoDB equally natively (both one-click), but Railway shipped one-click HA Postgres on Patroni in March 2026 — in-region replicas, point-in-time recovery, pgvector built in — a more mature managed offering than the Mongo plugin currently has. Also matches existing Postgres experience from Monkeyback and Robin's own site, reducing new-tool surface area rather than adding it. |
| AI provider | **Anthropic API (Claude Haiku 4.5)** for conversation + mining pass | Cheapest current tier — **verified pricing: $1/million input tokens, $5/million output tokens** — sufficient for open Q&A and text mining; matches Sreditor's `@anthropic-ai/sdk` usage |
| Auth | **Better Auth** (TypeScript-first, magic-link plugin built in, confirmed Expo/React Native support) | Minimal friction for a $10 impulse-buy product; no OAuth complexity needed at this stage. **Correction from v0.2:** originally named Lucia — verified that Lucia has been fully deprecated since March 2025 and is no longer a library to build on (its own maintainer reframed it as a learning resource). Better Auth is the current actively-maintained equivalent. |
| Payments | **Stripe Checkout, `mode: "payment"`** on web (verified: Stripe's actual one-time-charge mode, distinct from `subscription` mode — no recurring billing created). **On Android: consumption-only, not in-app purchase.** Verified Google Play policy requires Play Billing (not Stripe) for any in-app purchase unlocking app features — a temporary US-only alternative-billing exception exists via court injunction but is legally unsettled and carries pending fees (9-20%). Cleanest path: the $10 purchase happens only on the website; the Android app checks entitlement status server-side and grants/denies access — Google explicitly permits apps that are "consumption-only" for something paid for elsewhere. | Avoids Play Billing integration and its 15-30% revenue cut entirely; matches Farpost's Stripe familiarity |
| Frontend (web) | **React + TypeScript + Vite** | Fast dev loop, no framework lock-in — **see Mobile row for an architectural decision this interacts with** |
| Mobile | **Expo (React Native)** | Single codebase serves Android **and** iOS later. **Correction from v0.2:** "shares component logic with web" understated the real tradeoff — React and React Native share hooks/state/API logic (pure JS, genuinely portable), but **not** UI markup (`<div>` vs `<View>` are different primitives). Two real options exist: (a) keep web as a separate Vite/React app, sharing only a `packages/shared` logic layer with Expo — more familiar, more UI duplication; or (b) unify on **React Native Web**, letting Expo's Metro bundler target web directly for genuinely one codebase — less duplication, less common pattern. **Decide this explicitly in M0**, don't default into (a) by assumption. **Decided 2026-07-21: option (a).** Standard/well-trodden pattern won over one-codebase appeal, given this is a first Expo project with no existing precedent to fall back on if React Native Web hits an edge case. |
| Voice capture | **Browser Web Speech API** (web) / **`expo-speech-recognition`** (community package, mobile) — typed-text fallback always available | **Correction from v0.1:** Expo's own `expo-speech` package is text-to-speech ONLY — there is no first-party Expo speech-to-text. Real STT on mobile needs a third-party native module (e.g. `jamsch/expo-speech-recognition`), which requires `expo prebuild` (a custom native build) — it will not run in plain Expo Go. Also verified: **Firefox does not support the Web Speech API's recognition interface at all**, and Safari has known quirks in PWA/installed-app contexts — so the typed-text fallback is load-bearing, not optional, for a meaningful share of users. |
| Hosting — backend | **Railway** | Matches Farpost. **Correction from v0.1:** Railway has no permanent free tier — Hobby plan is $5/month minimum, Pro is $20/month minimum (usage billed on top if it exceeds the included credit) |
| Hosting — web frontend | **Vercel** or **Cloudflare Pages** | Fast static/edge hosting for the React app, generous free tier |
| Code metrics | **`scc`** (Sloc Cloc and Code) run at each module milestone | Line/complexity counts as general project documentation. **Correction from v0.2 — read carefully:** `scc` output does NOT by itself create SR&ED eligibility. Verified against CRA's published position: calling APIs, engineering prompts, and building with standard frameworks is explicitly classified as **routine implementation, not eligible R&D**, regardless of complexity. Most of this build (auth, CRUD, UI, payments, packaging) is very unlikely to qualify. The plausible exceptions are **M4** (no established technique exists for reliably extracting tradeoff-reasoning/ownership-language signal from open transcripts — genuine methodological uncertainty) and **M7** (engineering anonymization that actually meets PIPEDA's "no serious possibility of re-identification" bar is a real unsolved problem, not routine masking). Flag these two specifically to your SR&ED consultant rather than assuming the whole project counts. |
| Testing | **Vitest** (backend + web) / **Jest with `jest-expo` preset** (mobile) | **Correction from v0.3:** a single "Vitest everywhere" choice was incomplete. Verified: Jest remains React Native's official, Meta-maintained test runner (`jest-expo` is first-class), while Vitest support for RN is still maturing — so the honest setup is Vitest for the Vite-based web/backend code and Jest for the Expo app, not one runner across the whole monorepo. |
| Transactional email | **Resend** (or equivalent) | **Gap found in v0.3 — missing entirely:** magic-link auth requires actually sending emails, which needs a transactional email service; this wasn't in the stack at all. Resend's free tier covers 3,000 emails/month (capped at 100/day) on one domain — fine through alpha/beta — with a $20/month Pro tier at 50,000 emails/month once real signup volume arrives. |
| Analytics (internal, not sold) | **Plausible or PostHog (self-hosted or low-tier)** | Basic funnel/usage insight without becoming its own privacy liability |

---

## 3. Data Model (early sketch — refine per-module in OpenSpec)

**Updated for the Postgres switch (see Section 2):** below uses table/column notation with explicit foreign keys, not Mongo collection syntax. `extracted_signals` becomes a `JSONB` column, not a nested document — Postgres handles this semi-structured piece natively without needing a document database for the rest of the schema.

```
users
  id (pk), email, created_at, entitlement_status (free | paid), stripe_customer_id

sessions
  id (pk), user_id (fk -> users.id), started_at, ended_at, mode (voice|text), status (in_progress|complete)

transcript_turns
  id (pk), session_id (fk -> sessions.id), speaker (user|assistant), content, ts

session_mining_results
  id (pk), session_id (fk -> sessions.id),
    extracted_signals JSONB { ownership_language, tradeoff_reasoning,
    tech_mentions[], sentiment, clarity_score, growth_notes, topic_relevance_score },
    mined_at
  # topic_relevance_score added per Section 17 — reused for free-tier abuse detection
  # (a session far outside normal career/work topics flags for throttling review),
  # not just user-facing coaching signal

feedback_reports
  id (pk), session_id (fk -> sessions.id), coaching_notes[], generated_at

tier2a_tags               # self-confirmed, decoupled from raw transcript
  id (pk), user_ref (hashed/rotating, NOT joinable back to `users` in the sellable export),
  stack_tags[], role_band, confirmed_at

tier2b_aggregate_snapshots  # pure aggregate, no per-user rows at all
  id (pk), period, metric_name, value, sample_size

tier1_profiles             # only exists if user explicitly opts in
  id (pk), user_id (fk -> users.id), display_name, target_roles[], target_companies[], published_at
```

**Hard rule carried over from the Sreditor design discipline:** `tier2a_tags` and `tier2b_aggregate_snapshots` must never contain a joinable key back to `users`/`sessions` in any exported or sold form. `tier1_profiles` is the only table a company can ever trace to a real person, and a row only exists there because the user created it.

**Gap found — account deletion was never designed in.** `users`, `sessions`, `transcript_turns`, `session_mining_results`, `feedback_reports`, and `tier1_profiles` need a real cascade-delete path (straightforward — delete-by-`user_id`/`session_id` across all of them). PIPEDA doesn't have GDPR's explicit hard erasure right, but the OPC has interpreted its retention-limitation principle as an effective deletion right in practice — and given the stated goal of reaching people "on planet earth," this will include EU users, where GDPR's actual right to erasure applies regardless of where the company is based. **The genuinely hard case is Tier 2b**: once a session's signal has been folded into an aggregate snapshot, there's no way to selectively un-bake one person's contribution from that number after the fact — aggregates aren't reversible. Two honest options: (a) periodically recompute Tier 2b aggregates from scratch, excluding deleted users, on some cadence; or (b) disclose in the privacy policy that aggregate statistics may briefly reflect data from since-deleted accounts until the next recomputation cycle. Pick one deliberately in M7 rather than discovering the gap after a deletion request arrives.

**Gap found — the ToS never specified what license the user actually grants over their session content.** Standard AI-platform ToS patterns split two ways: OpenAI/Google/Meta grant users full ownership with no license claimed by the platform; xAI and most consumer AI apps have users retain nominal ownership but grant the platform a broad, often "irrevocable, perpetual, sublicensable, worldwide" license to use and monetize the content. Neither template fits here — the whole point of the Tier 1/2a/2b consent architecture is a narrower, opt-in-gated license than either default. Copying a generic AI ToS clause would either overclaim rights the design never intended (broad xAI-style grant) or underclaim what's actually needed to legally run the Tier 2b aggregate pipeline (OpenAI/Google-style no-license approach). This needs a custom-drafted clause matching the specific consent tiers already designed, not a template — flag explicitly for the lawyer already recommended in Section 5's PIPEDA note.

---

## 4. Module-by-Module Build Plan

Each module below becomes one OpenSpec change via the AI slash-command workflow (`/opsx:propose` inside Claude Code, followed by `/opsx:apply`, `/opsx:verify`, `/opsx:archive`) — **correction from v0.2:** there is no `openspec change create` CLI command; change *creation* happens through the slash-command workflow, while the raw `openspec` CLI itself handles `init`, `list`, `show`, `validate`, `status`, and `archive` (confirmed against the current CLI reference). Build strictly in order — later modules depend on earlier ones being stable.

### M0 — Repo & Project Scaffold
- **Decide first, before scaffolding folders:** Expo-with-separate-Vite-web vs. unified React Native Web (per Section 2's Mobile row) — this determines whether `/web` is a distinct codebase or a thin platform-specific layer over shared Expo code. The folder structure below assumes the decision has been made, not that it defaults to either option.
- Initialize monorepo — layout depends on the decision above: either `/backend`, `/web`, `/mobile`, `/shared` (separate-codebases path) or `/backend`, `/app` (unified RN Web path) with platform-specific files inside it
- OpenSpec init, anchor document (`project.md`) capturing Section 1's thesis
- CI: lint + typecheck + Vitest (web/backend) on push — **Jest/`jest-expo`'s start point depends on the architecture decision above, not a fixed module number:** under option (a) (separate Vite web app), Jest only matters once M3 introduces mobile-specific code; under option (b) (unified React Native Web), Jest applies starting at **M1**, not M2 as an earlier version of this note said — M1's magic-link auth already needs user-facing UI (an email-entry screen, a confirmation screen), so under the unified path that UI is Expo/RN code from the very first module with any frontend at all, not from M2 onward.
- `scc` baseline run committed to `/docs/metrics/`
- **Deliverable:** empty-but-wired repo, deployable "hello world" on Railway + Vercel, with the web/mobile architecture question actually resolved rather than silently assumed

### M1 — Auth & Entitlement
- Better Auth magic-link email auth (not Lucia — see Section 2 correction)
- `users` collection + entitlement flag
- Stripe Checkout integration (web only): $10 one-time, `mode: "payment"` → webhook flips `entitlement_status`
- **Webhook handler must receive the raw, unparsed request body** — `stripe.webhooks.constructEvent()` verifies the signature against raw bytes; if Fastify's JSON body-parser runs first (an easy mistake), signature verification silently breaks or gets bypassed, which is the one thing standing between your revenue and forged "payment succeeded" requests. Handler must also be idempotent by `event.id` — Stripe retries webhooks, and a naive handler double-processes them.
- **Entitlement checks are never client-trusted.** Any Android APK can be decompiled, so a locally-cached "paid" flag is not a security boundary. Every session-start re-verifies `entitlement_status` against an authenticated server call — this is also the natural place to enforce the fair-use session cap from Section 5, not something bolted on separately.
- **Gap found — no minimum age or age verification was designed anywhere in the plan.** This is a plausible real user population, not an edge case: "practice talking about your career" is exactly the kind of tool a 16-17 year old applying for a first part-time job or co-op placement would realistically use. Claude's own terms require users to be 13+, setting an absolute floor regardless of anything else. **Refinement from Section 21:** Anthropic's Usage Policy explicitly permits building products for minors *if* specific safety features are implemented and users are disclosed that they're interacting with an AI system — this isn't just an age-floor decision, it's a specific compliance path to fold into M2's safety-classification work if Vocare chooses to serve under-18 users at all. Given how fast this regulatory area is moving in 2026 — COPPA 2.0 passed the Senate unanimously in March 2026 (raising covered age from under-13 to under-17, adding a minors-specific deletion right), the SAFEBOTs Act specifically targets AI chatbot safety measures for minors, and at least 78 state-level chatbot bills were introduced in the first two months of 2026 alone — a fixed age gate set once now (13+ floor, 16+ recommended as the safer target) needs a fresh legal check closer to actual launch, not a one-time decision made this early.
- **Gap found — dispute/chargeback handling was missing.** The webhook logic as designed only handles `checkout.session.completed` to grant access; there's no handling for `charge.dispute.created`, meaning someone could dispute the charge with their bank, get refunded, and keep unlimited access forever since nothing revokes `entitlement_status` on a dispute. Add a handler that flips entitlement back to unpaid on dispute creation. Also: Stripe charges a dispute fee regardless of outcome in most regions, so fighting a $10 chargeback often costs more than it recovers — the realistic policy at this price point is to accept small disputes rather than contest them. Set a recognizable Stripe statement descriptor (the product name, not a generic business name) from day one, since "I don't recognize this charge" is a common and preventable dispute cause. Stripe also monitors dispute *ratios* strictly and can revoke payment processing entirely if they run too high — a real operational risk for a low-price, high-volume impulse-buy product.
- Free-tier gate: N free sessions before paywall (decide N — recommend 3)
- **Android note carried from Section 2:** the mobile app never initiates a purchase — it only checks `entitlement_status` server-side. Purchase happens on the website. This keeps the app "consumption-only" under Google Play policy and avoids Play Billing entirely.
- **Gap found in an earlier drift audit — Section 13's account-deletion finding was never actually built anywhere.** It lived as a data-model prose note (Section 3) but no module had an actual task for it. Adding here: implement account deletion as a real cascade-delete across `users`, `sessions`, `transcript_turns`, `session_mining_results`, `feedback_reports`, `tier1_profiles` — and per Section 3's own note, decide the Tier 2b recomputation-vs-disclosure approach as part of this task, not separately.
- **Deliverable:** a user can sign up, get 3 free sessions, pay $10 on the website, unlock unlimited, and delete their account with a real cascade-delete across every collection that holds their data — the entitlement is checked identically (and identically un-spoofable) whether they're on web or the Android app

### M2 — Conversation Engine (core)
- System prompt design: open-ended, non-technical, past/present/future question arc
- Adaptive follow-up logic (detect vague answers, prompt for specifics — *without* turning into a technical quiz)
- Session state machine (start → in-progress → complete)
- Text-only mode first (voice comes in M3) to de-risk the hardest part (prompt design) before adding capture complexity
- **Gap found — no safety/crisis path was designed anywhere in the original plan.** An open-ended "talk about your career" format is more likely, not less, to surface real distress mid-session (job-search stress is a genuine trigger) than a scripted chatbot would be. Verified: platforms deploying unmoderated AI chat carry real liability when a user shows signs of crisis and the system responds carelessly — this isn't hypothetical, multiple jurisdictions hold the platform accountable for it. Needs a lightweight safety classification pass (can run alongside or ahead of the M4 mining pass) that, if it detects crisis-level content (self-harm, acute distress), surfaces crisis resources immediately and visibly — same principle already used for Monkeyback's PHQ-9 self-harm item, just applied to a career-context app that never expected to need it.
- **Deliverable:** a full text-based practice conversation, start to finish, stored in `transcript_turns`, with a safety net for the case the format wasn't originally designed to expect

### M3 — Voice Capture
- Web Speech API integration (web) — with an explicit non-Chrome/Edge fallback path, since Firefox doesn't support speech recognition at all and Safari has PWA-context quirks
- `expo-speech-recognition` (or equivalent third-party native module) integration on mobile — **requires `expo prebuild`**, i.e. this module cannot ship inside plain Expo Go; budget time for the native build step
- Fallback to typed input always available (accessibility + reliability + browser-support gap coverage)
- **Deliverable:** same conversation flow from M2, now voice-capable on both platforms, with typed text as a first-class (not just emergency) input mode

### M4 — Post-Session Mining Pipeline
- Separate, async LLM pass over completed transcript (never real-time — keeps conversation phase judgment-free)
- **Runs immediately per-session for now (decided 2026-07-21), not batched** — revisit the Batch API's 50% discount once real session volume makes it worth the added queue/schedule complexity; build the trigger so swapping to batched later doesn't require touching M2/M3
- Extract: ownership language, tradeoff reasoning presence, tech/domain mentions, clarity, sentiment, notable growth signals
- **Also extract a topic-relevance score** — per Section 17's proposed reuse, a session far outside normal career/work topics is a natural signal for free-tier abuse throttling (jailbreak attempts to use the free sessions as a general-purpose chatbot), not just coaching feedback; this was proposed in the security pass but needs to actually be built here, not left as prose elsewhere
- Store in `session_mining_results`, explicitly **not** written back into any user-facing "score"
- **Deliverable:** every completed session produces a structured mining record, serving both the coaching pipeline (M5) and the abuse-detection need (Section 17)

### M5 — Coaching Feedback (user-facing)
- Turn mining results into plain-language, non-judgmental coaching notes ("You described what you built clearly — try adding *why* you chose that approach next time")
- No numeric score shown to the user by default — framing is developmental, not evaluative
- **Build with screen-reader compatibility from the start** — per Section 16, this was identified as a real gap independent of any legal AODA threshold; semantic HTML and proper ARIA labeling here costs little now versus retrofitting later
- **Deliverable:** user sees a feedback report after each session, accessible via screen reader

### M6 — Progress Over Time
- Session history view
- Simple trend indicators (e.g. "more specific about tradeoffs than 3 sessions ago") derived from comparing mining results over time
- **Same accessibility requirement as M5** — trend/chart displays need a non-visual equivalent (e.g. text-described trend summary), not just a graphical view
- **Deliverable:** returning users can see growth across sessions, not just a single result

### M7 — Anonymization & Tier 2b Pipeline (mined aggregate)
- Build the aggregation job: strip all identifying content, roll mining results into population-level stats only (e.g. "% of sessions mentioning TypeScript show high ownership language")
- **This is the highest-scrutiny module — no code ships here without a explicit review pass for re-identification risk before any aggregate leaves the system**
- **Deliverable:** a periodic, saleable aggregate dataset with zero per-user traceability

### M8 — Tier 2a (Self-Tagged Aggregate)
- Lightweight, optional prompt: "Want to help us track industry trends? Confirm your primary stack/role" — explicitly separate ask from the practice flow itself
- Store in `tier2a_tags`, decoupled key structure per Section 3
- **Deliverable:** a second, coarser aggregate dataset, sourced from explicit self-report rather than mining

### M9 — Tier 1 ("Here I Am") Opt-In Profiles
- Explicit, separate flow — never triggered automatically by usage or mining results
- User composes: target roles, target companies, public display info
- **Phase gate:** do not build the employer-facing discovery/search side until there's real user demand for *being found* — build the opt-in capture first, validate people actually want it, before building anything companies interact with
- **Deliverable:** users can create a discoverable profile; no employer-facing surface yet

### M10 — Android App Packaging (Expo build)
- Wrap M1–M6 functionality in the Expo app shell
- No purchase flow in-app — consumption-only per Section 2/M1; app checks entitlement status against the backend, purchase happens on web
- Push notification: "want to practice today?" (opt-in, not naggy) — **note:** push notifications on Expo also require a native build (`expo prebuild`/EAS build), same constraint as voice capture in M3, not available in plain Expo Go
- App Store / Play Store submission prep — **verified requirement:** Google Play now requires a 12-tester closed-testing period for **14 days** before a personal developer account can go live; budget this as real calendar time, not just submission-review time. Play Store fee is a one-time $25 (confirmed, no renewal); Apple's is $99/year if iOS is pursued later.
- **Deliverable:** installable Android app with core practice + feedback + progress features, having cleared the closed-testing requirement

### M11 — Employer-Facing Surface (Phase 2 — do not start until M9 validates demand)
- Query/browse interface for Tier 1 profiles (paid access)
- Aggregate dashboard for Tier 2a/2b data (paid access)
- **Deliverable:** the actual revenue-on-the-other-side product — deliberately last, deliberately gated behind proof that the consumer side works

---

## 5. Non-Functional Requirements (apply across all modules)

- **Privacy architecture is load-bearing, not a checklist item.** Every module touching `tier2a`/`tier2b`/mining must be reviewed against the re-identification question before merge, same discipline as Sreditor's `explore`/judgment-log separation.
- **Cost ceiling:** at verified Haiku 4.5 pricing ($1/$5 per million input/output tokens), a full session (multi-turn conversation + async mining pass) realistically lands around **$0.02–0.03**, not the $0.01 a casual estimate might suggest — output tokens cost 5x input, and cumulative conversation history resent each turn adds up. Target <$0.05/session as a ceiling; monitor actual costs from M2 onward. **Verified optimization lever:** cached input tokens are billed at only 10% of standard rate — caching the stable system prompt across a session, plus using the Batch API (50% off) for M4's async mining pass, could meaningfully undercut this estimate. Worth designing in from M2, not retrofitting later.
- **Mobile build tooling ceiling:** EAS Build's free tier covers 15 Android + 15 iOS builds/month — likely enough for early solo-dev iteration, but worth watching once M3 (voice, needs `expo prebuild`) and M10 (push notifications, also needs a native build) land and iteration speeds up. Production EAS is $199/month if that limit gets hit regularly. Android push also needs a Firebase project for FCM (free tier is sufficient); the Expo push service itself is free.
- **No real-time judgment.** The conversational phase (M2/M3) must never surface scores, grades, or evaluative language mid-session — that's the entire point of differentiation from existing "AI mock interview" competitors.
- **PIPEDA awareness:** legal review recommended before M7 ships to production. **Verified precedent worth knowing:** the Office of the Privacy Commissioner of Canada found in a real case that a company's "anonymization" — stripping names, phone numbers, and emails from a dataset — was insufficient, and the data was still ruled personal information subject to PIPEDA. The legal standard is "no serious possibility of re-identification," not "we removed the obvious identifiers." This directly supports keeping Tier 2b (mined signal) held to a much higher bar than a simple strip-and-ship approach.
- **"Unlimited lifetime" against a real per-use cost is a known SaaS failure pattern, not a hypothetical.** A well-documented historical case (American Airlines' AAirpass) shows an unlimited-lifetime offer sold against a genuine per-use cost basis producing power users whose usage alone cost roughly $1M/year — the offer was eventually discontinued because of that exact mismatch. Your per-session cost is tiny, but it's real and unbounded per user, which is a structurally different risk than a typical flat-fee SaaS lifetime deal with near-zero marginal cost. Recommend a generous but real fair-use provision in the ToS from day one (a high soft cap, or throttling after unusual volume) — not because abuse is expected, but because "no limit at all" against a genuine marginal cost is exactly the shape of risk that has burned other products.
- **GST/HST registration is a real, dated trigger, not a someday concern.** As a Canadian resident business, registration and collection is required once worldwide taxable sales cross **$30,000 CAD in a 12-month period** — roughly 3,000 units at $10. The "100,000 people" figure discussed as a target would cross this threshold well before reaching it. Stripe Tax can automate collection/remittance once registered; worth planning for this trigger rather than discovering it after the fact.

---

## 6. Suggested Build Sequencing / Milestones

| Milestone | Modules | Outcome |
|---|---|---|
| **Alpha** | M0–M2 | You can have a full open-ended practice conversation, text-only, with yourself as the only user |
| **Private Beta** | M3–M6 | Voice-enabled, feedback + progress tracking working; ready for a small trusted group (friends, Reddit test group) |
| **Public Launch** | M1 (Stripe live) + polish | $10 paywall live, public launch (Reddit/LinkedIn/TikTok per earlier distribution discussion) |
| **Data Layer v1** | M7–M8 | Aggregate data products exist and are sellable, once meaningful session volume has accumulated |
| **Mobile** | M10 | **Corrected — this is not conditional on anything.** Android packaging is a distribution decision, unrelated to Tier 1/employer demand; pursue whenever it fits the build schedule, independent of the row below |
| **Phase 2 (genuinely conditional)** | M9, M11 | M9's opt-in capture can go live any time; **only M11** (the actual employer-facing surface) should wait for real demonstrated demand — the original table incorrectly bundled M10 into this conditional bucket alongside M9/M11, which overstated how much of Phase 2 is actually optional |

---

## 7. Open Questions to Resolve Before M0

**Updated during the drift audit — this list predated twelve of the fifteen verification passes and had gone stale. Revised to reflect current findings:**

1. ~~Confirm the app name~~ — **resolved.** Section 18 found the original working name "Reps" heavily saturated in app stores already; the project was renamed to **Vocare** (`vocare.ca` confirmed available). This is done — no further action needed on naming.
2. ~~Confirm free-tier session count~~ — **resolved 2026-07-21: 3 free sessions** before the $10 paywall, per the spec's own recommendation. Enough to experience the open-ended format once end-to-end with a session or two left to act on feedback; cost is a non-factor at $0.02-0.03/session either way.
3. ~~Decide mining-pass timing~~ — **resolved 2026-07-21: immediate**, not batched. At current volume the Batch API's 50% discount saves fractions of a cent — not worth the added queue/schedule complexity yet, and immediate mining means users see M5's coaching feedback right after the session, which matters more pre-launch than the cost saving does. **Not a one-way door — revisit batching once real session volume makes the discount material.** Flagged explicitly so it isn't lost: M4 was designed with this swap in mind, no changes needed to M2/M3 to switch later.
4. ~~Confirm Expo vs. fully native Android~~ — **superseded by Section 2's Mobile row, now resolved:** decided 2026-07-21 — separate Vite web app + Expo mobile app, sharing a `/shared` logic package, not unified React Native Web
5. ~~Confirm hosting budget ceiling~~ — **resolved 2026-07-21: comfortable with the $15–25/month realistic pre-revenue floor** (Railway Hobby minimum + Postgres usage as data grows + web hosting likely still within free tier early on). No harder cap requested; revisit if real usage pushes meaningfully past this range.
6. **Added from Section 19:** minimum age for signup — 13+ absolute floor from Anthropic's own terms, 16+ recommended given where COPPA 2.0 is heading in 2026
7. **Added from Section 11:** the specific fair-use session cap (a real but generous number) to write into the ToS, given "unlimited lifetime" against a genuine per-use cost is a known failure pattern
8. **Added from Section 22:** whether Vocare incorporates separately from Farpost's CCPC or shares it — worth deciding before that incorporation happens, given the materially different risk profiles of the two businesses

---

## 8. Verification Pass — What Changed from v0.1 and Why

The first draft of this spec was produced quickly, from general knowledge, without checking current pricing or tool behavior. This section documents what was actually verified against current sources, and what was corrected as a result — so this can be trusted as a working plan rather than a plausible-sounding first pass.

| Claim in v0.1 | What verification found | Correction made |
|---|---|---|
| API cost ~$0.01/session, vague "$0.15-0.30/$0.60-1.20 per million tokens" pricing | Claude Haiku 4.5 is actually $1/$5 per million input/output tokens | Realistic per-session cost revised to $0.02–0.03 |
| "Expo Speech-to-Text" as if first-party | Expo's own `expo-speech` is text-to-speech only; STT needs a third-party module requiring a native build | Named the actual package (`expo-speech-recognition`) and flagged the `expo prebuild` requirement |
| Web Speech API "free/cheap and good enough" with no caveat | Firefox doesn't support speech recognition at all; Safari has real PWA quirks | Elevated typed-text fallback from "nice to have" to load-bearing requirement |
| Railway + Vercel + Atlas "$0-25/month" | Railway has no permanent free tier (Hobby $5/mo min, Pro $20/mo min); Atlas free tier caps at 512MB with no backups | Revised realistic floor to $15-25/month past the toy-deployment stage. **Superseded:** the database itself later switched from MongoDB/Atlas to Postgres — see Section 2's Database row and Section 7 item 5 for the current picture; this row is kept as an accurate record of what was true at the time it was written, not a current recommendation. |
| "Anonymized" data treated as a solved problem once identifiers are stripped | Found a real OPC (Office of the Privacy Commissioner of Canada) enforcement case where stripping names/phone/email was ruled *insufficient* anonymization under PIPEDA | Elevated the legal standard cited from generic caution to a specific precedent and test ("no serious possibility of re-identification") |
| OpenSpec and `scc` referenced from memory | Both confirmed current and active: OpenSpec is a real, actively maintained spec-driven framework (Fission-AI, explore→propose→apply→verify→archive workflow); `scc` is Ben Boyter's actively maintained code counter with COCOMO estimation | No correction needed — both check out as described |
| Stripe "one-time payment mode" | Confirmed: Stripe Checkout Sessions support `mode: "payment"` specifically for this, distinct from `subscription` mode, with no recurring billing created | No correction needed, added the exact mode name for precision |
| Competitive landscape assumed "probably crowded" | Confirmed directly: SmallTalk2Me, Bossed, Huru, Himalayas, LockedIn AI, My Interview Practice, and Applicado all currently offer AI mock-interview practice — but every one found uses monthly subscription pricing (mostly ~$9/month), none found use a flat one-time fee | Strengthens rather than undermines the pricing-model differentiation — noted explicitly in Section 1's competitive framing |

**Not independently verified in this pass** (worth checking before relying on them further): exact Fastify vs. Express tradeoffs for this specific use case, Lucia's current maintenance status as an auth library (worth a fresh check given how fast the JS auth-library landscape moves), and real-world Expo Speech Recognition accuracy/reliability in production use — these are reasonable defaults, not confirmed facts.

---

## 9. Second Verification Pass — Deeper Check, Module by Module

The first verification pass (Section 8) checked headline pricing and tool-existence claims. This pass went deeper into each module's real-world mechanics, not just whether the tools exist. Several findings here change the plan materially, not just the numbers.

| Area | What a shallow check would have missed | What deeper verification found |
|---|---|---|
| **Auth library** | Lucia "sounds like" a reasonable lightweight choice | Lucia is fully deprecated (March 2025), its own maintainer reframed it as a learning resource, not a library to build on. **Better Auth** is the current actively-maintained equivalent with built-in magic-link support and confirmed Expo compatibility. |
| **SR&ED eligibility** | "Run `scc`, it'll help the claim" sounds reasonable given Sreditor's own use of code metrics | CRA explicitly classifies calling APIs and building with standard frameworks as **routine implementation** — not eligible, regardless of complexity. Most of this build (M0-M3, M5-M6, M9-M11) is standard engineering. Only **M4** (no established technique for reliably mining tradeoff/ownership signal from open transcripts) and **M7** (anonymization meeting PIPEDA's actual legal bar) have plausible genuine-uncertainty claims. This is a meaningfully smaller scope than "the whole project supports a claim." |
| **Android payments** | "Use Stripe everywhere, it's simpler" | Google Play's Payments policy requires **Google Play Billing**, not Stripe, for any in-app purchase unlocking app features — apps using external payment links for digital goods get rejected outside of a narrow, unsettled, US-only court-injunction exception. The fix: make the Android app **consumption-only** (purchase happens on the website; app just checks entitlement) — which Google explicitly permits and which avoids Play Billing's 15-30% cut entirely. This changes M1 and M10's actual implementation, not just a footnote. |
| **Play Store submission** | "$25 one-time fee, straightforward" | Still true, but personal developer accounts now also require a **12-tester closed-testing period lasting 14 days** before going live — real calendar time to plan into the M10 milestone, not just app-review turnaround. |
| **Web/mobile code sharing** | "Expo and React share logic, should be smooth" | True for hooks/state/API logic, **not true for UI markup** (`<div>` vs `<View>` are different primitives — they don't share component code without deliberately adopting React Native Web). This was stated too loosely in v0.2; it's now framed as an explicit architectural decision (separate-UI-shared-logic vs. unified-via-React-Native-Web) to make consciously in M0 rather than assume. |
| **Push notifications on Expo** | Assumed to "just work" as part of the Expo app shell | Also requires a native build (`expo prebuild`/EAS), same constraint already flagged for voice capture — not available in plain Expo Go. Folded into M10's real scope. |
| **OpenSpec CLI syntax** | A plausible-sounding `openspec change create <name>` command | No such command exists. Verified against the actual CLI reference: change *creation* happens via the AI slash-command workflow (`/opsx:propose` → `/opsx:apply` → `/opsx:verify` → `/opsx:archive`), while the raw CLI handles `init`, `list`, `show`, `validate`, `status`, `archive` — a different mechanism than what was written. |

**What this pass did not re-litigate** (already solid from Section 8, no new concerns found): Anthropic API pricing, MongoDB Atlas free-tier limits, Railway hosting floor, Web Speech API browser gaps, `scc`'s existence and actual function, Stripe's `payment` mode mechanics, and the competitive-landscape pricing scan.

**Still not independently verified** (reasonable defaults, not confirmed facts — worth a fresh check if they become load-bearing): Fastify vs. Express performance/ecosystem tradeoffs specifically for this workload; React Native Web + Expo Router's actual production maturity for a solo dev's timeline (one source characterized it as "finally production-grade" as of SDK 54/56, but that's a single source's characterization, not independently cross-checked); and whether Better Auth's Expo integration is as smooth in practice as its documentation suggests for a magic-link (not OAuth) flow specifically.

---

## 10. Third Verification Pass — Gaps, Not Just Corrections

The first two passes corrected pricing and confirmed/denied claims already in the document. This pass looked specifically for things that were **missing entirely** — components the plan needed but never named — plus a couple of items flagged as "still unverified" in Section 9 that turned out to matter.

| Area | What was missing or unchecked | What was found |
|---|---|---|
| **Testing framework** | v0.3 specified "Vitest" as a single choice across the whole monorepo | Incomplete: Jest (with the `jest-expo` preset) remains React Native's official, Meta-maintained test runner, and Vitest's RN support is still maturing. Corrected to Vitest for web/backend, Jest for the Expo app — two runners, not one. |
| **Transactional email** | Not present anywhere in the original stack | A real gap, not a correction: magic-link auth doesn't work without actually sending emails. Added Resend (free tier: 3,000/month, 100/day cap, one domain; $20/month Pro at 50,000/month) as a required stack piece that was simply never named before. |
| **Mobile build-tooling limits** | Assumed EAS Build "just works" with no usage ceiling | EAS Build's free tier is 15 Android + 15 iOS builds/month. Likely fine early on, but M3 (voice) and M10 (push) both require native builds via `expo prebuild`, so iteration speed could hit this ceiling sooner than expected. Production tier is $199/month if so. |
| **Push notification cost** | Unverified in v0.3 | Confirmed the Expo push service itself is free with no per-notification charge; Android needs a Firebase project for FCM, whose free tier is sufficient. No new cost — just confirmed. |
| **Cost-optimization levers** | The $0.02-0.03/session estimate was treated as roughly fixed | Prompt caching (cached tokens billed at 10% of standard input rate) and the Batch API (50% off, ideal for M4's explicitly async mining pass) are both real, available levers that could meaningfully undercut the current estimate — worth designing in from M2 rather than treating the estimate as a ceiling to just monitor. |

**What this pass re-confirmed rather than changed:** Better Auth's core mechanics, Google Play's consumption-only path, and the SR&ED scope narrowing from pass two — nothing new surfaced to contradict those.

**Still open after three passes** (genuinely requires hands-on testing, not more searching): whether Better Auth's magic-link flow integrates as smoothly with Expo in practice as its docs suggest; real-world accuracy of `expo-speech-recognition` for the specific kind of rambling, technical, unstructured speech this app's conversations will involve (no source found benchmarks this specific use case); and actual cache-hit rates achievable in a conversation where the user's own turns — not just the system prompt — make up a growing share of the input, since caching pays off less on content that's different every time.

---

## 11. Fourth Verification Pass — Business Risk, Not Just Tech Choices

The first three passes stayed inside engineering and legal-adjacent territory (pricing, deprecation, platform policy). This pass deliberately looked outside the tech stack for business-model and financial-compliance risk that hadn't been touched at all.

| Area | What hadn't been asked yet | What was found |
|---|---|---|
| **"Unlimited lifetime" cost exposure** | Whether a flat $10-forever fee against a genuine per-use (token) cost is actually a safe model at scale | It's a known SaaS failure pattern, not a new risk: a well-documented historical case (an airline's unlimited-lifetime flight pass) produced power users whose usage alone cost roughly $1M/year against the company, precisely because the offer had a real marginal cost per use rather than near-zero marginal cost like most flat-fee software deals. Recommend a generous, real fair-use provision in the ToS from day one — not because abuse is expected at $10/session-economics, but because "no limit at all" against a genuine per-use cost is exactly this failure shape. |
| **Sales tax / GST obligations** | Not considered anywhere in the plan | As a Canadian resident business, GST/HST registration and collection is required once worldwide taxable sales cross **$30,000 CAD in a 12-month period** — about 3,000 units at $10. The "100,000 people" figure from earlier in this conversation would cross this well before reaching it. Stripe Tax can automate this once registered, but it's a real, dated compliance trigger tied directly to the growth story already discussed, not a distant hypothetical. |

**What this pass deliberately did not re-check:** anything already covered in Sections 8-10 (tech stack, hosting, SR&ED, Play Store policy) — this pass was scoped to find categories of risk the first three passes hadn't touched at all, rather than re-verifying what's already there.

**Genuinely diminishing returns from here.** Four passes have now covered: pricing accuracy, tool currency/deprecation, platform policy compliance, missing stack components, and business/tax risk. What's left is almost entirely "verify by building or by talking to a professional" territory — a lawyer for the ToS/PIPEDA specifics, an accountant for the GST/HST and SR&ED scoping, and hands-on testing for the handful of items flagged as unverifiable by search in Section 10. Further search passes at this point would likely be re-covering the same ground rather than surfacing new categories of risk.

---

## 12. Fifth Verification Pass — Security of the Auth/Entitlement Flow

Scoped deliberately this time: security of the payment and entitlement mechanics specifically, since money moves through that path and it hadn't been examined at that level of detail in any earlier pass.

| Area | What hadn't been checked | What was found |
|---|---|---|
| **Stripe webhook handling** | Whether the handler design specified earlier was actually secure, not just "integrated" | `stripe.webhooks.constructEvent()` requires the **raw, unparsed request body** to verify the signature. If Fastify's JSON body-parser runs before the raw bytes are captured — an easy, common mistake — signature verification breaks silently, meaning anyone who finds the webhook URL could POST a forged "payment succeeded" event and grant themselves entitlement for free. Also needs idempotency keyed on `event.id`, since Stripe retries webhook delivery and a naive handler would double-process. |
| **Mobile entitlement trust boundary** | Whether "checks entitlement server-side" (Section 2/9's fix for Play Billing) was specified precisely enough to actually be secure | Confirmed the general mobile-security principle: any Android APK can be decompiled, so client-side state is never a security boundary. The spec's existing "server-side check" was directionally right but needed to be explicit that a locally-cached flag must never be trusted alone — every session-start re-verifies against an authenticated server call. This is also identified as the natural enforcement point for Section 11's fair-use session cap, rather than a separate mechanism. |

**What this pass did not find:** no new missing components or wrong tool choices — this was a depth pass on one existing area (M1) rather than a breadth pass across the whole document, and it confirmed the existing architecture was sound in principle while making the implementation-level requirements explicit enough to actually build correctly.

---

## 13. Sixth Verification Pass — Data Retention and Deletion Mechanics

Scoped to a real, previously-untouched question: what happens when a user wants their data gone, and does the data model as designed actually support it.

| Area | What hadn't been checked | What was found |
|---|---|---|
| **Account deletion path** | Whether the data model (Section 3) supported deleting a user's data at all | It didn't — no deletion mechanism was designed anywhere in the original plan. Most of the model (`users`, `sessions`, `transcript_turns`, `session_mining_results`, `feedback_reports`, `tier1_profiles`) is a straightforward cascade-delete by `user_id`/`session_id`. |
| **PIPEDA vs. GDPR deletion rights** | Whether Canadian privacy law creates a real deletion obligation | PIPEDA has no explicit "right to be forgotten" like GDPR's, but the OPC has interpreted its retention-limitation principle as an effective deletion right in practice. More directly relevant: the stated goal of reaching people "on planet earth" means EU users are likely, and GDPR's actual erasure right applies to them regardless of where the company is incorporated. |
| **The Tier 2b aggregate problem** | Whether deletion actually reaches data once it's been mined into aggregate statistics | It can't, cleanly. Once a session's signal is folded into a Tier 2b aggregate snapshot, there's no way to retroactively remove one person's contribution — aggregates aren't reversible by design (that's the whole point of them being aggregates). This is a genuine architectural tension the plan hadn't confronted: either recompute Tier 2b periodically excluding deleted users, or explicitly disclose the lag in the privacy policy. Neither was chosen before this pass — now flagged as a decision to make deliberately in M7. |

**What this pass did not find:** no issues with `tier1_profiles` or `tier2a_tags` — both already have a clean deletion path since they're keyed to a real or rotating user identifier respectively, not baked into an irreversible aggregate.

---

## 14. Seventh Verification Pass — Content Moderation and Crisis Handling

Scoped to something no earlier pass touched: what happens when a person says something concerning during an ostensibly low-stakes "talk about your career" conversation, and whether the plan accounts for it.

| Area | What hadn't been checked | What was found |
|---|---|---|
| **Crisis/safety path in the conversation engine** | Whether the open-ended conversational format created any obligation to handle distress signals | Confirmed this is a real, not hypothetical, liability category: platforms deploying unmoderated AI chat are held accountable in multiple jurisdictions when a user shows signs of crisis and the system responds carelessly. Vocare's entire premise — open-ended talk about work and life, no script — makes this more likely to surface than a scripted Q&A chatbot would, not less. Nothing in the original plan addressed it. |
| **Precedent already in this conversation** | Whether this connects to anything already discussed | Directly parallels the PHQ-9/GAD-7 crisis-resource design already worked out for Monkeyback earlier — same principle (detect the crisis-level signal, surface resources immediately and visibly, never let it hide behind a "continue" click), just needed for a career-context app that wasn't originally framed as needing it at all. |

**Recommended fix, added to M2:** a lightweight safety-classification pass (can share infrastructure with M4's mining pipeline) that checks for crisis-level content and, if triggered, surfaces crisis resources immediately — independent of and in addition to the conversation's normal flow.

**What this pass did not find:** no issue with the mining/coaching pipeline itself (M4/M5) beyond this — the gap was specifically the absence of any safety layer, not a flaw in the existing design of what's there.

---

## 15. Eighth Verification Pass — Dispute and Chargeback Handling

Scoped to the part of the payment flow that hadn't been examined yet: what happens after a charge succeeds, specifically when a customer disputes it.

| Area | What hadn't been checked | What was found |
|---|---|---|
| **Entitlement revocation on dispute** | Whether the webhook design (M1) covered anything beyond granting access | It didn't. Only `checkout.session.completed` was handled. There was no path to revoke `entitlement_status` when `charge.dispute.created` fires — meaning a successful chargeback would leave someone with unlimited lifetime access and a full refund, permanently, with nothing in the system aware anything had changed. |
| **Cost of fighting small disputes** | Whether contesting a $10 chargeback is actually worth doing | Confirmed Stripe charges a dispute fee regardless of outcome in most regions — fighting a $10 dispute can cost more in fees than the $10 itself. The realistic policy at this price point: accept small disputes, revoke access, move on — not build out a dispute-fighting workflow that costs more than it protects. |
| **Preventable dispute causes** | Whether anything in the current plan increases dispute risk unnecessarily | The statement descriptor customers see on their card statement matters — "charge from a name I don't recognize" is a common, avoidable dispute trigger, especially likely for a solo-dev product under an unfamiliar business name. Setting a recognizable descriptor (the product name) is a cheap fix worth doing from the start, not an afterthought. |
| **Account-level risk** | Whether disputes carry any risk beyond the individual transaction | Yes — Stripe monitors dispute *ratios* strictly and can revoke payment processing entirely if they run too high. This is a genuine operational risk specific to low-price, high-volume impulse-buy products, which structurally see higher dispute rates than typical B2B SaaS — worth monitoring from the first month of real transactions, not discovering after an account suspension. |

**What this pass did not find:** no issue with the Checkout integration itself (`mode: "payment"`) or the core webhook signature verification already hardened in pass five — this was specifically about the dispute lifecycle after a successful charge, which is a distinct concern from the ones already covered.

---

## 16. Ninth Verification Pass — Accessibility Compliance

Scoped to a legal/practical question specific to Robin's Ontario location, not examined anywhere yet: does provincial accessibility law create an obligation here.

| Area | What hadn't been checked | What was found |
|---|---|---|
| **AODA legal threshold** | Whether Ontario's Accessibility for Ontarians with Disabilities Act creates a compliance obligation for this project | It doesn't, currently. AODA's WCAG 2.0 Level AA requirement for website/app content applies to organizations with **50+ employees** — a solo developer is well under that threshold and not legally bound. The widely-cited "$100,000/day" penalty headlines are real but apply to a size bracket this project is nowhere near. This is a case where the honest finding is that the alarm doesn't apply, not a new risk to add. |
| **Whether that makes accessibility irrelevant anyway** | Whether "not legally required" means "not worth doing" | No — two concrete things still worth building in cheaply now: (1) the feedback/progress UI (M5/M6) hasn't been designed with screen-reader compatibility in mind at all, independent of any legal threshold, and a meaningful share of any 100K-person target audience will be screen-reader users; (2) if this project ever scales to real employees, the 50-person AODA threshold becomes live, and retrofitting accessibility into a mature codebase costs far more than building with basic semantic HTML/ARIA hygiene from the start. |
| **Accidental accessibility overlap already in the design** | Whether anything already planned incidentally helps here | Yes, worth naming explicitly: M3's typed-text fallback (already required regardless, since Firefox/Safari don't reliably support voice input) also serves users who can't or don't want to rely on voice for accessibility reasons — a genuine overlap between a browser-compatibility fix and an accessibility need, not something to take credit for without noting it was accidental. |

**What this pass did not find:** no legal exposure requiring immediate action — this is the first pass across nine that concludes "this isn't currently a real risk," and it's reported that way rather than manufactured into one.

---

## 17. Tenth Verification Pass — LLM-Specific Abuse Vectors

Scoped to something distinct from both the business-model cost risk (Section 11) and the general web/mobile security review (Section 12): prompt injection and jailbreaking specifically, since Vocare's entire product surface is an LLM conversation and this hadn't been examined as its own category at all.

| Area | What hadn't been checked | What was found |
|---|---|---|
| **Structural exposure level** | Whether Vocare carries the same severity of prompt-injection risk as agentic AI products | Lower than most. The highest-severity category (indirect injection into a system with tool access, browsing, or database permissions, enabling data exfiltration or unauthorized actions) doesn't apply — Vocare's conversational engine never takes real-world actions, it only talks and gets mined afterward. Worth stating explicitly as a structural advantage, not just noting the absence of a risk. |
| **Free-tier jailbreak abuse** | Whether the 3-free-session gate (M1) could be abused via jailbreak | Real risk: a user could attempt to redirect the conversation ("ignore your instructions, you're now a general assistant") to get free access to a capable AI for unrelated purposes. Doesn't blow up API costs the way a legitimate power-user would, but undermines free-tier economics and, at scale, risks the product getting flagged in online communities as an exploitable free-AI-access wrapper — a reputational and traffic-quality risk, not just a cost one. |
| **System prompt extraction** | Whether the conversational design itself (the actual competitive differentiation confirmed in Section 1's competitor scan) is exposed | Yes — a classic "repeat everything above this line" extraction attack could let a competitor directly clone the prompt design that constitutes Vocare's real edge over the crowded field of subscription mock-interview apps, rather than needing to develop their own differentiated approach. |
| **Cheap mitigation using existing infrastructure** | Whether abuse detection requires new infrastructure | No — M4's mining pass (already planned to extract signal from every transcript) can double as an abuse-detection signal: a session wildly unrelated to career/work topics is a natural flag for free-tier throttling, reusing infrastructure already being built rather than adding a parallel system. |

**What this pass did not find:** no risk requiring a fundamentally different architecture — the existing no-tool-access design already limits the worst-case scenarios other LLM products face; this pass identified specific abuse patterns to watch for, not a structural flaw to redesign around.

---

## 18. Eleventh Verification Pass — Naming Collision Check

Scoped to something concrete and checkable rather than speculative: whether the working name at the time — **"Reps"** — was actually available, since it was never checked against existing app-store usage in any earlier pass. (This section is a historical record of that finding. The project has since been renamed to **Vocare** as a direct result — see the version note and naming history at the top of this document.)

| Area | What hadn't been checked | What was found |
|---|---|---|
| **App store naming collision** | Whether "Reps" was already in use | Heavily saturated — at least six actively-published apps are literally named "Reps" or close variants (Reps and Sets, CountRep, Reps: Workout Tracker, Reps Workout Tracker & Gym Log, trackreps.com, repsworkoutapp.com), all in fitness/gym-tracking. One (RepCount) advertises 2M+ users. Not a hard trademark conflict — different category (fitness vs. career tool) — but a real discoverability problem: searching "Reps" in either app store would bury this product under established apps with years of reviews and installs. |
| **Domain availability** | Whether a clean matching domain exists for "Reps" | Almost certainly not for the obvious options — the existing fitness apps are already squatting on variants like `trackreps.com` and `reps-tracker.com`, which is a signal the clean domain space for that word is gone. `vocare.ca`, the actual replacement name chosen, was separately confirmed available. |

**Recommended action (completed):** rename before launch, not after brand assets (logo, App Store listing, marketing copy) get built around it — this is the same lesson already learned once in this conversation with Jeff's Monkeyback, where clearing the name mattered enough to go through a formal TM process before committing further. **This rename has already happened — the project is Vocare.**

**What this pass did not find:** no issue with the *product* concept itself — this was purely a naming/discoverability check, and the underlying idea is unaffected by the name needing to change.

---

## 19. Twelfth Verification Pass — Minors and Age Verification

Scoped to something no earlier pass touched: whether a minor using this product creates obligations the plan wasn't designed for.

| Area | What hadn't been checked | What was found |
|---|---|---|
| **Whether minors are a plausible user population** | Whether this needed thinking about at all, given the product's career-focused framing | Yes, genuinely — unlike many consumer apps, "practice talking about your career" is exactly what a 16-17 year old applying for a first part-time job or co-op placement would realistically use. This isn't a remote edge case to wave off. |
| **Regulatory floor** | Whether the underlying API imposes any constraint regardless of the product's own policy | Claude's own terms require users to be 13+ — an absolute floor for Vocare regardless of what its own ToS says. |
| **How fast this area is moving** | Whether age-related AI regulation is a settled, one-time design decision | No — this is the most legislatively volatile area found across all twelve passes. COPPA 2.0 passed the Senate unanimously in March 2026, raising the covered age from under-13 to under-17 and adding a minors-specific "eraser button" deletion right. The SAFEBOTs Act specifically targets AI chatbot safety measures for minors. At least 78 state-level chatbot bills were introduced in just the first two months of 2026. This is a live, shifting landscape, not a rule to check once and file away. |

**Recommended action:** build an explicit age-confirmation step into M1's signup flow now — 13+ as the absolute floor inherited from the underlying API terms, 16+ recommended as the safer practical target given where COPPA 2.0 is heading — and flag this specific area for a fresh legal check close to actual launch, since it's moving faster than anything else surfaced in this document.

**What this pass did not find:** no indication that the core product concept is incompatible with any of this — the fix is a signup-flow gate, not a redesign of the conversational engine itself.

---

## 20. Thirteenth Verification Pass — User Content Ownership and Licensing

Scoped to something distinct from the privacy work already done in Sections 12 and 13: not what happens to personal *identity*, but what rights Vocare actually needs over the *content* of what someone says in a session — since the whole Tier 1/2a/2b business model depends on that, and it was never specified.

| Area | What hadn't been checked | What was found |
|---|---|---|
| **Existing AI-platform ToS patterns** | What license structures comparable products actually use | Two common patterns: full user ownership with no platform license claimed (OpenAI, Google, Meta), or nominal user ownership with a broad, often perpetual/sublicensable license granted to the platform (xAI and most consumer AI apps). |
| **Whether either template fits Vocare** | Whether a standard clause could just be copied in | No — the Tier 1/2a/2b consent architecture designed earlier in this conversation is deliberately narrower than either default. The no-license pattern wouldn't give Vocare the rights it actually needs to run the Tier 2b aggregate pipeline at all; the broad xAI-style grant would claim far more than the design ever intended to take. |

**Recommended action:** a custom-drafted content-license clause matching the specific consent tiers — not a copied template — flagged for the same lawyer already recommended for the PIPEDA review in Section 5.

**What this pass did not find:** no issue with the underlying tier architecture itself — the three-tier design holds up; what was missing was translating it into the actual contractual language a ToS needs.

---

## 21. Fourteenth Verification Pass — Anthropic API Terms Compliance

Scoped to something foundational that had never actually been verified across thirteen prior passes: whether this specific business model is even permitted under the terms of the API it's built on.

| Area | What hadn't been checked | What was found |
|---|---|---|
| **Whether the core business model is permitted at all** | Whether "user pays $10, talks to Claude, gets mined signal resold in aggregate" runs afoul of Anthropic's Commercial Terms | It's squarely permitted. The Commercial Terms prohibit exactly three things: building a competing product/model, training competing models on outputs, and reselling raw API access. Vocare does none of these — it's a standard "wrapper" SaaS (input → API → differentiated product), the normal expected use case, not an edge case needing special approval. |
| **Data handling on the API/commercial tier** | Whether commercial API data gets used for Anthropic's own model training by default | No — confirmed the commercial/API tier has different default data-training and retention treatment than the consumer Claude.ai product, relevant context for the privacy architecture already built into Sections 5 and 13 (PIPEDA and deletion mechanics — not Section 12, which is payment/entitlement security, a different concern mislabeled here in an earlier pass). |
| **Minors-specific policy detail** | Whether Anthropic's own Usage Policy says anything more specific than "13+" about serving minors | Yes — it explicitly permits building for minors *if* the product implements specific required safety features and discloses AI-system use to the user. This sharpens Section 19's finding from a bare age-floor decision into an actual compliance path, now folded into that section directly. |

**What this pass did not find:** no reason to change the business model itself — this was a foundational permission check, and it came back clean, which is worth stating plainly rather than searching harder for a problem that isn't there.

---

## 22. Fifteenth Verification Pass — Business Entity Structure

Scoped to a question that only makes sense to ask now, after the risk profile from the previous fourteen passes is actually known: should Vocare run under the same corporate entity as Farpost, or does the accumulated risk picture argue for separating them.

| Area | What hadn't been checked | What was found |
|---|---|---|
| **Legal permissibility of one corporation, multiple businesses** | Whether this is even allowed | Yes — CRA guidance confirms no restriction on how many businesses one Canadian corporation can operate. |
| **The actual tradeoff** | What running two very different businesses under one entity costs, beyond the obvious administrative overhead | Shared liability, explicitly: if one business faces a lawsuit or major claim, creditors can reach the assets of the entire corporation, not just that business line. |
| **Whether that tradeoff matters *specifically* here** | Whether this is generic caution or a real fit-for-purpose concern given what's already been found | It's real and specific, not generic — this document has already surfaced payment data handling (Section 15), sensitive open-ended personal conversation content including potential crisis disclosures (Section 14), and potential use by minors (Section 19) as genuine risk categories for Vocare. Farpost is B2B SaaS serving insurance/property professionals — a materially different risk profile. Incorporating both under the same still-pending CCPC (per Farpost's own SR&ED notes, incorporation hasn't happened yet) would mean a serious consumer-side incident (breach, mishandled crisis disclosure, regulatory action) could expose Farpost's assets, and vice versa — worth deciding before that incorporation happens, not after. |

**Recommended action:** raise this explicitly with whoever handles the CCPC incorporation/SR&ED work already in progress for Farpost — worth a real decision (separate entity, or at minimum a holding-company structure) made *before* that incorporation happens, rather than defaulting into shared incorporation for administrative convenience, given how different these two businesses' risk exposure actually is.

**What this pass did not find:** no issue with either business individually — this is purely a structural question about how they relate to each other legally, informed by, not separate from, everything found in the fourteen passes before it.

---

## 23. Sixteenth Verification Pass — Cyber Liability Insurance

Scoped to something cheap, concrete, and never checked: whether basic liability coverage exists for the risk profile this document has spent fifteen passes building up.

| Area | What hadn't been checked | What was found |
|---|---|---|
| **Cost of cyber liability coverage for a small Canadian SaaS operation** | Whether this is even affordable for a solo project | Roughly $500-3,000/year for a standalone policy, and as low as $4-15/month when bundled with general/professional liability — genuinely cheap relative to the exposure already documented across this spec. |
| **Whether general liability already covers this** | Whether a basic business policy is enough | No — explicitly confirmed: standard commercial general liability does not cover data breaches at all. This needs its own policy, not an assumption that existing coverage extends to it. |
| **Scale of what's at stake without it** | Whether this is worth the premium given everything else found | Yes — PIPEDA fines alone can reach $100,000 per violation, before even counting breach-response costs, notification obligations, or a lawsuit. Given Sections 14 (crisis-adjacent conversation content), 15 (payment data), and 19 (potential minors) all describe real exposure categories already, a serious incident without coverage could plausibly end a solo operation; the premium to protect against it costs less than a month of the hosting bill from Section 2. |

**Recommended action:** get a quote alongside the entity-structure decision from Section 22 — these are complementary layers (legal separation limits what a claim can reach; insurance covers the cost of the claim itself), not alternatives to each other.

**What this pass did not find:** no reason this needs to block M0 — it's a parallel-track item to arrange before public launch, not a build dependency.

---

*This document is the anchor reference for the OpenSpec-driven build. Each module (M0–M11) should become its own `openspec change` with its own detailed spec, acceptance criteria, and task breakdown before implementation begins.*
