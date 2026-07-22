# Vocare Development Journal

**Purpose:** a complete, chronological record of *everything* — every brainstorm, decision, reversal, rethink, mockup iteration, tooling hiccup, and build action — not just the curated highlights. Requested by Robin (2026-07-21) specifically so that "what is this project, how did we make it, and how has it kept evolving" can be answered fully, at whatever level of detail someone wants, months or years from now.

**How this differs from the other docs, so nothing gets duplicated:**
- **`CLAUDE.md`** — the rules Claude operates under. Stays short by design (its own rule 9). Doesn't change often.
- **`BUILD_LOG.md`** — a curated narrative of *real milestones* ("a module completed, a real decision made, a mistake caught") — the highlights reel, deliberately selective.
- **`vocare-project-specification.md`** — the living technical spec. Decisions get threaded into the actual module tasks here as the *outcome*. This is what to build.
- **This journal** — everything else: the *process*. The brainstorming that led to a decision, the wrong turns, the "wait, why did you change that," the exact sequence of what happened and when. Comprehensiveness over curation — nothing is too remedial to record here.

**Structure:** one file per working session/day, named `YYYY-MM-DD.md`, in this folder. Each file is a chronological account of that session. This index just lists them with a one-line hook, so a reader can either skim this page for orientation or open any specific day for the full account.

**Session stats — standard part of every entry, added 2026-07-21.** Each day's file ends with a "Session stats" section: commit count, unique files touched, lines changed, and the drift-audit yield for that session, all computed from `git log`, never estimated. **Deliberately excluded: token counts or dollar cost.** Neither is reliably self-reportable from inside a session — the real number lives in the Anthropic Console's usage dashboard, tied to the project's API key. Don't guess at it here.

**Sessions:**
- [2026-07-21](2026-07-21.md) — First laptop session: read the planning docs, locked in the tech stack decisions (npm, Docker, architecture, pricing at $29), designed the anchors/audience-targeting feature end to end, worked through crisis-safety design under real pushback, built and iterated the UI mockup and brand/logo through several rounds of correction, set up the two-instance (`chat`/`cli`) dev process, ran multiple speculative gap-finding passes, and got all tooling installed and verified. Ends right before M0 actually starts.
- [2026-07-22](2026-07-22.md) — `cli` implements M1 (Auth & Entitlement) end to end: schema, magic-link auth, Stripe billing, session entitlement, account deletion. A real Stripe-account mix-up caught before it became a bookkeeping problem, a port collision with an unaccounted-for native Postgres 17 service, and two real bugs (hijacked-route CORS bypass, a stale-error UI bug Robin caught via their own real inbox) found only by actually running the app. Real Stripe test-mode checkout and dispute driven end to end via `stripe listen`. Production Railway Postgres provisioned and env vars wired, deliberately stopping short of an actual production deploy. All 44 `tasks.md` items complete; handed off to `chat` for independent grading.
