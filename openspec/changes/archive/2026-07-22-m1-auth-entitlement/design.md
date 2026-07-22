## Context

M0 shipped an empty-but-wired Fastify backend and Vite web app with no database and no auth. This change introduces the first persistent data (Postgres, not yet provisioned locally — Docker Desktop isn't running yet) and the first real money-handling code in the repo (Stripe). Nothing downstream — M2's conversation engine, M4's mining pipeline, M6's progress view — can attach data to a real user until this lands, so the schema decisions here are load-bearing for every later module, not just M1's own scope.

Two infra pieces the M1 spec assumes are not live yet per the M0 handoff: `api.vocare.ca` (Railway) and a Resend sending subdomain. Both are needed for a real magic-link email to reach a user; this change's tasks include standing them up, not just the application code.

## Goals / Non-Goals

**Goals:**
- A user can sign up passwordlessly, get 3 free sessions, pay $29 once, and have that entitlement checked identically (and identically unspoofable) on web and future-Android.
- Money-handling code (webhook signature verification, idempotency, dispute revocation) is correct on the first pass — this is a rule-5 sensitive module, graded independently by `cli`.
- Account deletion is a real, complete cascade — not a partial delete that leaves orphaned rows in tables added after the original design (the anchors-table gap the spec itself flags).

**Non-Goals:**
- Not building M2's crisis-detection logic. This change only defines `sessions.crisis_flagged` as a column other modules read/set; the detection that sets it is M2's scope.
- Not building the mobile (Expo) UI. M1's Android surface is limited to a server-side entitlement check call; the app shell is M10.
- Not finalizing legal text. Age-gate copy, ToS no-refund wording, and velocity-cap thresholds are implemented as configurable/placeholder values, not hardcoded final copy.
- Not building M9's Tier 1 opt-in profile or M7's Tier 2b aggregation pipeline — this change only flags the one open question (below) where M7's future design constrains a decision made here (deletion cascade).

## Decisions

**Postgres client: Drizzle ORM + `drizzle-kit` migrations, not Kysely or Prisma.** No ORM exists yet in the backend (`package.json` has only Fastify). Better Auth ships official adapters for Kysely, Drizzle, and Prisma. Kysely is Better Auth's own internally-used query builder — the most "native" fit for the auth tables specifically — but this app has many more non-auth tables (`sessions`, `transcript_turns`, `anchors`, `anchor_revisions`, and more arriving in M2–M6) where Drizzle's schema-first TypeScript definitions and straightforward migration diffing pay off more broadly than optimizing narrowly for the auth tables alone. Prisma was considered and rejected: its codegen step doesn't fit the existing `tsx watch` dev loop as cleanly, and it's heavier than this solo-dev, low-volume project needs.

**Stripe webhook raw-body handling: a scoped Fastify plugin with its own content-type parser, not a global one.** Fastify's JSON body parser is registered globally by default; overriding it globally to preserve raw bytes would affect every route, not just the webhook. Instead, the webhook route is registered inside its own encapsulated Fastify plugin (Fastify's plugin scoping means a content-type parser registered inside a plugin only applies to routes within that plugin) with `addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => done(null, body))`, so `stripe.webhooks.constructEvent()` gets the exact raw bytes Stripe signed, and every other route keeps Fastify's normal parsed-JSON behavior untouched.

**Webhook idempotency: a `stripe_webhook_events` table with a unique constraint on `event.id`, not an in-memory cache.** An in-memory dedup set wouldn't survive a Railway restart/redeploy, and Stripe explicitly retries webhooks over a multi-day window — long enough to outlast most in-memory approaches anyway. The handler inserts `event.id` and flips `entitlement_status` in the same transaction; a unique-violation on insert means "already processed," and the handler returns 200 immediately without reprocessing.

**Velocity cap and free-session count: computed from `sessions` rows at query time, not mutable counter columns.** Both the rolling 24h/30-day velocity cap and the "3 free sessions" gate are implemented as `COUNT(*) WHERE user_id = $1 AND created_at > now() - interval '...'` (velocity cap, counts at session start) and `COUNT(*) WHERE user_id = $1 AND status = 'complete' AND crisis_flagged = false` (free-session gate, counts at completion) against an indexed `(user_id, created_at)` column, rather than a separately-maintained counter column on `users`. A mutable counter is a second source of truth that can drift from the actual session log (e.g., a bug that increments without a matching session row); a computed count can't drift because it has no independent state to desync. Alternative considered: Redis-backed sliding-window counters — rejected as infra this project doesn't need yet at expected launch volume; a Postgres index comfortably serves this query pattern at the scale M1 is designed for.

**Age gate: capture full date of birth, not a "13+/16+" checkbox.** A boolean confirmation can't be re-evaluated if the recommended floor changes after the flagged legal review (13+ floor vs. 16+ target is explicitly unresolved in the spec). Storing DOB lets the actual enforced threshold change later as a pure config value, with no re-collection needed from existing users.

**Country capture: browser-locale-derived default in an editable `<select>`, no IP geolocation.** The spec calls this a "light select/detect," not a real form field. Deriving a default from `navigator.language`/`Accept-Language` needs no new dependency or data flow; a third-party IP-geolocation lookup would add exactly the kind of infrastructure and privacy surface this field was explicitly scoped to avoid.

**Magic-link email delivery: Resend, via a custom `sendMagicLink` hook in Better Auth's config.** The M0 handoff already names Resend as the intended provider (a sending subdomain is called out as needed "once real email/API calls are wired up," which is now). Better Auth's magic-link plugin takes a `sendMagicLink(email, url)` callback — this change implements that callback against Resend's Node SDK rather than Better Auth's default (which has no built-in provider and requires exactly this kind of custom hook regardless of which provider is chosen).

**Account deletion: an explicit application-level transaction, not `ON DELETE CASCADE` foreign keys.** FK-level cascade deletes are simpler to write once but delete silently and unconditionally — any future module (M7's Tier 2b aggregation is the concrete case already flagged) that needs to *intercept* a deletion (e.g., to decide whether to recompute an aggregate or disclose that a contributing user was removed) can't hook into a cascade that already happened at the database level with no application code in the path. An explicit, ordered, transactional delete across the eight named tables keeps a single place in the codebase that owns "what happens when a user is deleted," which M7 can extend later without touching schema-level constraints.

Better Auth's own session/verification-token tables — created by its Drizzle adapter (§2.5), not defined by this design directly — belong in the same transactional delete list. A leftover auth-session or verification-token row after a "deleted" account would be exactly the kind of dangling, identity-linked data this task exists to eliminate. Their exact names aren't fixed here because they're generated by the adapter, not hand-designed; **`cli` must read the actual generated schema after §2.5 and add the real table names to `deleteUserCascade` (tasks.md §6.2) before that task is considered done** — typically `session`, `verification`, and `account` in Better Auth's default schema, but the generated names are the source of truth, not this guess.

## Risks / Trade-offs

- **Computed-count queries add load per session-start check.** → Mitigation: both queries are indexed range scans on a small per-user row count (nowhere near a scale where this matters); revisit only if real usage ever approaches a volume where it would.
- **Resend sending subdomain and `api.vocare.ca` aren't live yet — this change can't be fully verified end-to-end (real email delivery) until both exist.** → Mitigation: tasks.md sequences DNS/Railway setup before the magic-link send path is tested; local dev can use Resend's sandbox/test mode against a verified test address in the meantime.
- **A self-attested DOB is trivially falsifiable.** → Mitigation: this is a known, accepted limitation of self-attested age gates generally (no product at this stage does real age verification); the spec already flags this as needing a fresh legal check before launch, not a technical problem this change can solve.
- **Explicit transactional deletion means every new table holding user data must be remembered and added to the delete path by hand.** → Mitigation: this is the same failure mode that already happened once (`anchors`/`anchor_revisions` were added to the M1 spec's deletion list two days after the fact, per the spec's own note) — tasks.md includes a single, obviously-named function (e.g. `deleteUserCascade`) as the one place this list lives, making "did the next module update this" a one-file grep instead of an audit.

## Migration Plan

- Local Postgres via Docker (`postgres:16-alpine`, host port 5433, per CLAUDE.md) stood up before any migration runs — currently not running.
- `drizzle-kit` generates and applies the initial migration: `users`, `sessions`, `stripe_webhook_events`, plus forward-looking columns/tables this change's tables reference (`sessions.crisis_flagged`, `sessions.anchor_id` as a nullable FK placeholder for M6 — column exists now so M6 doesn't need a later migration to add a NOT-NULL-adjacent relationship onto rows that already exist).
- Env vars to add (Railway + local `.env`): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`.
- Infra to stand up before this change can be verified end-to-end: `api.vocare.ca` DNS + Railway custom domain, Resend sending subdomain + domain verification.
- Stripe: create the $29 **USD** one-time Product/Price (currency decided 2026-07-22 — see spec Section 2), set a recognizable statement descriptor, register the webhook endpoint (test mode first) pointing at `api.vocare.ca/webhooks/stripe`, subscribe to `checkout.session.completed` and `charge.dispute.created`.
- Rollback: no prior auth/entitlement system exists, so rollback is "don't deploy this change" rather than a data migration reversal. Once real users exist post-launch, a schema rollback would need a separate down-migration — not written here since no production data exists yet to protect.

## Open Questions

- **Tier 2b recomputation-vs-disclosure on deletion** (flagged in proposal.md, per spec Section 3): when a user who contributed to an already-published aggregate deletes their account, does the aggregate get recomputed, or does it stand with a disclosure note? M7 doesn't exist yet, so this change implements `deleteUserCascade` as the single interception point (per the Decisions section above) but does not resolve the policy question itself — deferred to M7's own design, not blocking M1's apply.
- **Exact velocity-cap thresholds** — implemented as a named config constant (e.g. `FAIR_USE_CAP = { per24h: <placeholder>, per30d: <placeholder> }`) sized loosely per the spec's own guidance (generous enough for 2-3 real sessions/day) but not tuned against real beta data, which doesn't exist yet.
- **Exact age-gate and no-refund ToS copy** — implementation-ready fields/UI exist; final legal wording is out of scope for this change per the spec's own flag for lawyer review.
