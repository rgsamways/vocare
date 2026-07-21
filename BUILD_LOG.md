# Vocare — Build Log

(Called "Reps" during planning, renamed once vocare.ca cleared — see Entry 0.)

A narrative record of how this got built, written in plain English at real milestones — not a replacement for git history or the OpenSpec archive, but the story those two don't tell on their own.

---

## Entry 0 — Origin (before the repo existed)

This project (called "Reps" at the time — see the header above) started as a reaction, not a plan. Robin failed an AI-driven technical screening interview (with "Zara") the same morning this conversation began — not for lack of ability, but because the interview tested syntax recall and "why A over B" trivia instead of the architectural judgment that 30 years of experience actually builds. That gap — AI screens rewarding the wrong signal — became the seed of the idea.

The concept evolved in conversation with Claude across several turns:
- Started as an anti-AI-interview idea (a human-judged alternative to trivia screens)
- Shifted to AI-enabled but non-adversarial: an open-ended conversational practice tool, not a quiz
- Landed on the actual model: a cheap ($10 lifetime, not subscription) unlimited-practice app, with an optional, strictly consent-gated data layer (Tier 1 opt-in profiles, Tier 2a self-tagged aggregate, Tier 2b mined aggregate) as a second, later revenue stream

A full specification (`vocare-project-specification.md`) was built and then stress-tested across **16 verification passes** (pricing accuracy, tool deprecation, platform policy, security, minors/age compliance, business entity structure, cyber insurance, and more) and **10 drift audits** checking the document against itself for internal consistency — catching real issues like a dead auth library (Lucia), a Google Play billing-policy conflict, a missing account-deletion mechanism, and several findings that were written in prose but never actually threaded into the build tasks they were supposed to change.

The database choice was revisited once more after the spec was "done" — switched from MongoDB to PostgreSQL on reflection that the original choice was inherited by analogy to Farpost rather than argued on this project's (then called "Reps," now Vocare) own data shape.

**Decided before any code existed:**
- Node.js/TypeScript end to end (matching Sreditor, not Farpost's Python/FastAPI) — a deliberate choice to deepen Robin's own Node fluency, directly in response to the interview loss that started this
- Speed-to-launch prioritized over slow, learning-maximized building
- A prime-directives file (`CLAUDE.md`) and this build log written *before* installs or scaffolding, after Claude jumped ahead and scaffolded folders without explicit permission — a real mistake, caught and corrected, that became the reason rule #1 exists in `CLAUDE.md`

---

## Entry 0.5 — Naming: Reps → Vocare

The working name "Reps" turned out to be heavily saturated in app stores already (multiple established fitness/gym-tracking apps, one with 2M+ users) — a real discoverability problem, not just an aesthetic one, found during the verification passes.

Renamed to **Vocare** after a short brainstorm considering both Latin-rooted and invented options. Landed on Vocare over the runner-up "Rungs" for tone — Rungs read a little too close to a gamified habit-tracker, while Vocare (root: Latin *vocare*, "to call," source of "vocation") fit the more elegant, experienced-professional positioning better. A nice accident: Robin naturally pronounces it "vo-CARE" rather than the more Latin "vo-CAH-reh" — which quietly evokes the word "care" on top of the vocation root, fitting the coaching/developmental tone of the product either way it's read.

`vocare.ca` confirmed available and being purchased; new GitHub repo being started separately from this planning conversation.

---

## Entry 1 — Repo Created

Repo created at `github.com/rgsamways/vocare`, cloned to `c:\dev\vocare`. Planning docs (`CLAUDE.md`, `BUILD_LOG.md`, `HANDOFF.md`, `vocare-project-specification.md`) committed and pushed 2026-07-21 — no code yet, documents only.

---

## Entry 1.5 — Pre-M0 Decisions Locked

Before any scaffolding, three open questions from the spec's Section 7 got resolved in conversation with Claude:

- **Package manager: npm (workspaces).** Checked every other active project (Sreditor, Farpost web, Monkeyback frontend, Taplog web) — all use `package-lock.json`, none use pnpm. Matching that beats an abstract "which is better" argument.
- **Local Postgres: Docker (`postgres:16-alpine`), host port 5433.** Matches the existing pattern in Farpost API and Monkeyback (both already run Postgres via `docker-compose.yml`). Port 5433 chosen specifically to avoid colliding with the native Postgres 18 Windows service and Monkeyback's own container, both of which sit on 5432.
- **Web/mobile architecture: separate Vite web app + Expo mobile app, sharing a `/shared` logic package** (not unified React Native Web). This was the one genuinely new decision with no existing project to match against. Chosen because it's the standard, well-documented pattern, and because being able to explain *why* — React and React Native share logic but not UI markup, `<div>` vs `<View>` are different primitives — is itself a better answer to "why A over B" than the trivia-style AI screen that started this whole project.

Also settled: the install list for M0 (OpenSpec CLI, `scc`, `sreditor`, `jscpd`, `sem`, Expo/EAS CLI, Stripe CLI, plus Railway/Vercel CLIs once deployment is actually being built).

---

## Entry 1.6 — Audience-Targeted Practice, added to the plan

An interface mockup (`mockups/interface-v1.html`) surfaced a real product idea before any code existed: let users optionally declare who they're practicing for (target role/industry), and use that to make the whole loop more relevant — sharper follow-up questions in M2, actual quoted phrases and role-language matching in M4/M5, and a qualitative audience-alignment trend in M6. Deliberately kept evidence-based (quoting real transcript phrases against a curated role-language reference set) rather than a fuzzy "sounds right for this employer" judgment, to stay inside the existing no-score, developmental-not-evaluative principle already locked into M5/M6. Explicitly kept separate from M8's Tier 2a self-tagging — this is a private practice preference, never sold or aggregated, not another consent-gated data-tier ask.

Folded into M2/M4/M5/M6 and the `users` table (Section 3) directly, since none of those modules are built yet — this is a design refinement, not a scope addition to something already shipped.

---

## Entry 2 — Tooling Installed

_Fill in: OpenSpec, scc, and anything else installed; versions; any install issues hit._

---

## Entry 3 — M0 Scaffold

_Fill in once M0 actually begins, with explicit go-ahead._

---

*Continue adding entries at real milestones — a module completed, a real decision made, a mistake caught and fixed. Not every commit; the moments worth explaining to someone looking at this afterward.*
