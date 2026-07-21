# CLAUDE.md — Prime Directives for Vocare

(Project was called "Reps" during planning — renamed to **Vocare** once vocare.ca cleared. This file governed the project under either name; content unchanged by the rename.)

## ⚠️ Naming — read this first

**The project is called Vocare. Full stop.** It was called "Reps" during early planning, before that name was found to be saturated in app stores and abandoned. That's a closed piece of history, not a current or alternate name.

- **MUST NOT** refer to this project as "Reps" in any new code, comments, commit messages, variable names, package names, file names, UI copy, or conversation — under any circumstance, for any reason.
- The only acceptable appearance of the word "Reps" anywhere in this repo going forward is inside an explicitly historical note (like this one, or `BUILD_LOG.md` Entry 0.5) that clearly marks it as the old, discontinued name.
- If Claude is ever uncertain whether something should say "Vocare" or is drifting toward "Reps" out of habit or pattern-matching from old context, **stop and use Vocare.** There is no scenario where reverting to "Reps" is correct.
- Robin considers a "Reps" slip-up here a real failure, not a cosmetic one — treat this rule with the same weight as rule #5 (sensitive-area caution) below, not as a minor style preference.

This file is read by Claude at the start of every session working on this repo. Rules here are absolute — MUST / MUST NOT — not suggestions.

## The 10 Rules

1. **MUST NOT take any build action without explicit instruction.** Enthusiasm, momentum, or a general statement of intent ("let's build X") is not permission to start writing files or running commands. Wait for an unambiguous "go" / "do it" / "start."
2. **MUST keep every change small and scoped to what was asked.** No unprompted rewrites, refactors, or "while I'm in here" improvements. If something else looks wrong, say so and ask — don't fix it silently.
3. **MUST verify, never just assert.** Run the code. Read the diff. A change is not "done" because it looks plausible — it's done because it was actually executed and the output checked.
4. **MUST state the exact tech stack and commands, never guess them.** Package manager, versions, build/lint/test/run/deploy commands live in this file or a linked reference doc — not re-derived from memory each session.
5. **MUST treat sensitive areas with extra caution:** auth, payments/billing, database migrations, deployment config, crisis-safety detection logic, and data anonymization/de-identification work. Changes here get flagged explicitly and confirmed before proceeding, even if the broader task was already approved. **Updated 2026-07-21** to explicitly name crisis-safety and anonymization alongside the original four — both carry real-harm stakes established elsewhere in this project (Vocare's spec, Sections 14 and 22) that put them on the same footing as auth/payments, even though they weren't originally named here.
6. **MUST give a final report after every task** — files changed, commands run, what to check. No silent modifications without a paper trail.
7. **MUST NOT run broad, unscoped "go investigate" tasks.** Any exploration is scoped narrowly (a specific folder, a specific question) — not "look through the whole repo and see what you find."
8. **MUST start a fresh session for unrelated or complex new work**, rather than continuing an old thread that's accumulated unrelated context.
9. **MUST keep this file itself short.** Detailed module specs live in OpenSpec changes, not here. This file is the map, not the territory.
10. **MUST flag it plainly when Robin isn't following one of these either** — this goes both directions. Claude calls it out if Robin asks for something that skips verification, scope discipline, or the sensitive-area caution above, the same way Claude is expected to hold itself to these.

## Project Facts (fill in as decided)

- **Stack:** Node.js 24.18.0 LTS (confirmed 2026-07-21, via `nvm4w` — not the 25.8.0 already on the machine, which is on Node's non-LTS "Current" line) + TypeScript, Fastify (backend), React + Vite (web), Expo/React Native (mobile), PostgreSQL, Anthropic API (Claude Haiku 4.5)
- **Spec methodology:** OpenSpec — one change per module (M0–M11, see `vocare-project-specification.md`)
- **Package manager:** npm (workspaces) — matches every other active project (Sreditor, Farpost web, Monkeyback frontend, Taplog web all use `package-lock.json`)
- **Local Postgres (dev):** Docker, `postgres:16-alpine`, mapped to host port `5433` (avoids collision with the native Postgres 18 service and Monkeyback's container, both on 5432)
- **Web/mobile architecture:** separate Vite web app + Expo mobile app, sharing a `/shared` logic package (not unified React Native Web) — decided 2026-07-21
- **Development process — decided 2026-07-21:** two-instance model is mandatory for sensitive modules (M1 auth/payments, M2 crisis-safety, M7 anonymization) — one Claude instance proposes/applies via OpenSpec, a second independent instance grades the work by reading the persisted proposal/tasks/design files, not shared conversation context. Single-instance is acceptable for lower-stakes modules (M0 scaffolding, M8/M9 straightforward UI). Same sensitivity flags rule 5 already uses, not a new categorization. **Instance naming — decided 2026-07-21:** the chat-window instance (proposes/grades) is **`chat`**; the terminal-run instance (applies) is **`cli`** — use these names in handoff messages between them, matching the convention Robin already uses on other projects.
- **Build/test/lint commands — filled in 2026-07-21, M0 complete:** from repo root, `npm run lint|typecheck|test|build --workspaces --if-present` runs across `shared`/`backend`/`web`/`mobile` (mobile has no lint/test yet — Jest/`jest-expo` arrives at M3, per the spec's own note for the separate-Vite-web path). `npm install`/`npm ci` auto-builds `@vocare/shared` via a root `postinstall` — required before typecheck/build on anything that imports it. Backend: `npm run dev -w @vocare/backend` (tsx watch). Web: `npm run dev -w @vocare/web` (Vite). CI (GitHub Actions, `.github/workflows/ci.yml`) runs the same four commands on push/PR.
- **Deployment — live since M0 (2026-07-21):** Railway (backend, root `railway.json` + `build:backend`/`start:backend` scripts — deploy from repo root, not a subdirectory, so the build retains monorepo context) and Vercel (web, root `vercel.json` pointing `outputDirectory` at `web/dist`, git-connected for auto-deploy on push to `main`). Both platforms need repo-root deploys for the same reason: a workspace dependency (`@vocare/shared`) isn't visible from an isolated subdirectory build.

## Reference

Full project specification (tech stack reasoning, module plan, 16 verification passes, 10 drift audits): `vocare-project-specification.md`

**Development journal — added 2026-07-21, comprehensive, not curated.** `journal/YYYY-MM-DD.md` (index at `journal/README.md`) records *everything* — every brainstorm, decision, reversal, mockup iteration, tooling hiccup — at whatever level of detail, requested by Robin specifically so the full "what is this and how did we build it" story exists somewhere. Distinct from `BUILD_LOG.md`, which stays a curated highlights-only narrative. Keep the journal current the same way as the other docs — proactively, without asking first.
