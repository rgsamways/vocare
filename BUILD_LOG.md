# Vocare — Build Log

(Called "Reps" during planning, renamed once vocare.ca cleared — see Entry 0.)

A narrative record of how this got built, written in plain English at real milestones — not a replacement for git history or the OpenSpec archive, but the story those two don't tell on their own.

**Added 2026-07-21 — this stays curated, on purpose.** For the comprehensive, nothing-too-remedial account of everything discussed and decided, see `journal/` instead — this file is the highlights reel, that one is the full record.

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

## Entry 1.7 — Anchors: from a flat field to a living, revisable goal

Follow-on brainstorm the same day pushed Entry 1.6's flat `target_role`/`target_industry` fields into a proper `anchors` table (Section 3) — a user can hold multiple anchors at once, and each one gets a dated revision log (`anchor_revisions`) instead of being silently overwritten, directly borrowing the shape of Sreditor's own `anchor.md` + `reflect` pattern. Two real decisions came out of this:

- **Richer anchor content (a pasted job description, a company name) is anchor-only — never read live by M2.** Only the light `target_role`/`target_industry` fields steer the live conversation's tone. Feeding a full JD into live follow-up logic risked recreating the scripted-checklist dynamic Vocare exists to reject; keeping it strictly post-session (M4/M5/M6 only) preserves the same real-time/reflective split the spec already enforces for safety and scoring.
- **Two real gaps got caught and assigned a home:** M6's "session history view" was underspecified (didn't say a user could actually reread a past transcript + feedback report, not just see a trend line) — clarified. And no module had ever specified where a profile/account screen lives at all — added a minimal one to M1 (email, entitlement, deletion trigger), with anchor management deliberately living in M6 instead, since editing a goal is a progress/coaching action, not an account-settings one.

Also parked two ideas deliberately, not built: reframing the category as "career conversations" rather than "mock interviews," and cross-session narrative callback in M2 — both written into a new Section 24 ("Parking Lot") in the spec rather than silently dropped.

---

## Entry 2 — Tooling Installed

Checked the machine before installing anything: Docker, `scc`, `sreditor`, `jscpd`, EAS CLI, Stripe CLI, Railway CLI, and Vercel CLI were already present (from earlier project work). Only `sem` was genuinely missing and needed a fresh install.

**Node version — deliberately not the one already installed.** The machine had Node v25.8.0 active via `nvm4w`, but `nvm list available` confirmed v25 sits on Node's "Current" (non-LTS) line, not the stable one — the actual current Active LTS is **24.18.0**. Switched to that deliberately, matching "most recent *stable*" rather than "most recent, period."

**Real friction hit, worth remembering:** `nvm4w` does not share global npm packages across Node versions — each version gets its own isolated global `node_modules`. Switching from 25.8.0 to 24.18.0 meant every npm-installed global CLI (`openspec`, `sreditor`, `jscpd`, `eas-cli`, `@railway/cli`, `vercel`) had to be reinstalled under the new version; `scc` and `sem` were unaffected since they're standalone binaries, not npm packages.

**A real catch, not just a reinstall:** the first `npm install -g openspec` installed the wrong package — a namesquatted, unrelated placeholder (`openspec@0.0.0`, published 2019, no relation to the actual tool). The real OpenSpec CLI (Fission-AI's spec-driven-development tool this whole project is built around) is published as **`@fission-ai/openspec`**. Caught by actually running `openspec --version` after install rather than trusting the install succeeded — exactly the "verify, never just assert" discipline this project has leaned on since before any code existed.

**`sem` install:** no Windows package-manager entry (chocolatey/scoop don't have it); installed from the GitHub release binary (`ataraxy-labs/sem`, `sem-windows-x86_64.zip`) to `%LOCALAPPDATA%\Programs\sem\`, added to user `PATH`.

**Confirmed working versions:** Node 24.18.0, npm 11.16.0, `@fission-ai/openspec` 1.6.0, `scc` 3.7.0, `sreditor` 0.0.1, `jscpd`/`cpd` 5.0.12, `eas-cli` 21.0.2, `railway` 5.27.2, `vercel` 56.4.1, `sem` 0.21.0.

**Still open:** `ANTHROPIC_API_KEY` is not set in the environment yet — needed before `sreditor judge` (or the app itself) can call the API. Robin's action, not something to set on his behalf. npm also flagged three postinstall scripts as blocked by its newer `allow-scripts` safety gate (`@railway/cli`, `esbuild`, `dtrace-provider`) — none of the affected tools failed their basic version checks, but worth knowing if something subtle breaks later.

---

## Entry 3 — M0 Scaffold

Robin gave explicit go-ahead in a fresh session (per rule 8), plus the answer to the one remaining open call M0 needed: **Vercel** over Cloudflare Pages for web hosting.

**Monorepo:** npm workspaces — `shared`, `backend`, `web`, `mobile` (in that dependency order, which matters — see the CI note below). Backend is Fastify, web is Vite/React scaffolded via `npm create vite`, mobile is Expo scaffolded via `create-expo-app`. Both backend and web import `APP_NAME` from `@vocare/shared` and have a real (non-placeholder) Vitest test — not just wiring, actually proven end-to-end with a clean-checkout test before trusting it.

**A real build-order bug, caught before it shipped:** `@vocare/shared`'s `types`/`main` point at its compiled `dist/`, which doesn't exist right after a fresh `npm ci` — so typecheck on anything depending on it failed on a clean checkout, which is exactly what CI does on every run. Fixed with a root `postinstall` that builds `shared` first, and made the Railway build command build `shared` explicitly too rather than lean on the hook firing at the right moment. Caught by actually wiping `node_modules`/`dist` and re-running the full pipeline locally before trusting CI would pass — not by assuming it would.

**OpenSpec init surfaced a real drift:** the spec's M0 task named a `project.md` anchor doc, but the installed CLI (1.6.0, confirmed real per Section 9's verification pass) has moved that mechanism to `openspec/config.yaml`'s `context` field instead — no file named `project.md` is read by any of the generated tooling. Wrote Section 1's product thesis into that field rather than creating a file nothing would actually consult.

**CI:** GitHub Actions running lint (`oxlint`) + typecheck + Vitest + build across workspaces on push, per the spec's "Vitest for web/backend, Jest deferred to M3" note. Verified locally against a full `node_modules`/`dist` wipe before trusting it, not just committed and hoped.

**Deployed, both platforms verified live:**
- **Railway** — backend at a generated `*.up.railway.app` domain, `/health` returns `{"status":"ok","app":"Vocare"}`. Deployed from the repo root (not a subdirectory) with a root `railway.json` and explicit `build:backend`/`start:backend` scripts, after verifying (via Railway's own docs, not assumption) that a "shared monorepo" service needs root-context build/start commands rather than an isolated Root Directory setting.
- **Vercel** — web app live, auto-connected to the GitHub repo (future pushes to `main` will now auto-deploy). First attempt deploying scoped to `web/` failed for a real, instructive reason: Vercel's CLI (without a linked project's Root Directory setting) only uploads the specified subdirectory, so `@vocare/shared` wasn't visible and `npm install` failed. Fixed the same way as Railway: deploy from repo root with a root `vercel.json` pointing `outputDirectory` at `web/dist`.
- Also fixed in passing: an `EBADENGINE` warning from `package.json`'s `engines.node` being pinned to the exact `24.18.0` patch, which Vercel's build image didn't match — loosened to `>=24.0.0 <25.0.0` (still the right major LTS line, just not over-pinned to a patch version this project doesn't actually depend on).

**scc baseline** captured in `docs/metrics/scc-m0-baseline.txt` for comparison at future module milestones, per the spec's own metrics row.

M0's deliverable — "empty-but-wired repo, deployable hello world on Railway + Vercel, with the web/mobile architecture question actually resolved" — is done. Next: M1 (auth & entitlement), the first module needing the two-instance chat/cli review process, since it's rule-5 sensitive.

---

*Continue adding entries at real milestones — a module completed, a real decision made, a mistake caught and fixed. Not every commit; the moments worth explaining to someone looking at this afterward.*
