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

_Fill in: date, GitHub repo URL, initial clone confirmed._

---

## Entry 2 — Tooling Installed

_Fill in: OpenSpec, scc, and anything else installed; versions; any install issues hit._

---

## Entry 3 — M0 Scaffold

_Fill in once M0 actually begins, with explicit go-ahead._

---

*Continue adding entries at real milestones — a module completed, a real decision made, a mistake caught and fixed. Not every commit; the moments worth explaining to someone looking at this afterward.*
