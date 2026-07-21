# HANDOFF — Phone → Laptop, Vocare Project

Read this first if you're picking up this project in a new session (Claude Code, VSCode, or otherwise) and don't have the original phone conversation in context.

## What Vocare is

An AI-conversational career/interview practice app. The pitch: AI interview screens (like the one that inspired this — Robin failed a technical AI screen with a company called "Zara" the same day this project started) reward syntax trivia over real judgment. Vocare is the opposite: people just talk — what they've built, what they're doing, what they want next — no quiz, no real-time scoring. Feedback and any data use happen only *after* the conversation. $10 lifetime fee, not a subscription. An optional, strictly consent-gated data layer sits behind it (three tiers — see the full spec).

## Where things stand right now

- **Name:** Vocare (was called "Reps" during planning — see `BUILD_LOG.md` Entry 0.5 for why it changed). `vocare.ca` confirmed available and being purchased.
- **No code exists yet.** No repo, no scaffold. Everything so far is planning documents.
- **Three documents should already be sitting alongside this one** (if they aren't in the repo yet, they're in the phone conversation's output folder and need to be added):
  1. `vocare-project-specification.md` — the full technical spec: tech stack (with reasoning), data model, 12 build modules (M0–M11), and **critically**, 16 verification passes plus 10 drift audits that caught real issues (a dead auth library, a Google Play billing-policy conflict, a missing account-deletion mechanism, and more). **Read this fully before writing any code** — it has hard-won corrections that will save real time if respected, and repeat real mistakes if ignored.
  2. `CLAUDE.md` — the 10 prime directives. These are absolute, not suggestions. Rule #1 (no build action without explicit instruction) exists because it was already violated once and caught.
  3. `BUILD_LOG.md` — the narrative history, Entry 0 onward. Keep adding to this at real milestones, not every commit.
- **Tech stack decided:** Node.js + TypeScript end-to-end — Fastify (backend), React + Vite (web), Expo/React Native (mobile), PostgreSQL (switched from an original MongoDB choice — see the spec's Section 2 for why), Anthropic API using Claude Haiku 4.5.
- **Why Node over Python:** deliberate — matches Sreditor (Robin's other AI-tooling project), and chosen specifically to build deeper Node fluency after the interview loss that started all this. This is a real motivation, not just a technical preference — worth remembering if a "just use what's familiar" shortcut ever seems tempting.
- **Priority: speed to launch**, not learning-maximized building. Scaffold and move fast; don't slow-walk it for pedagogical value.
- **Open decision still not made:** Section 2 of the spec flags a real architecture choice — separate Vite web app + Expo mobile sharing a logic package (more standard, more proven) vs. unified React Native Web (one codebase, less common pattern). Leaned toward the separate-apps path for speed, but this hasn't been formally locked in — confirm with Robin before M0 scaffolding assumes an answer either way.

## What NOT to do

- Don't start scaffolding, installing, or writing code without Robin explicitly saying so — even if the conversation's momentum makes it feel like a natural next step. This already happened once on the phone side (folders got created after "let's get past this" without a direct go-ahead) and had to be undone.
- Don't skip reading the full spec's verification sections (8 onward) to save time — they contain corrections that directly prevent real mistakes (e.g., don't build Android in-app purchases via Stripe; don't use Lucia for auth; don't assume MongoDB).
- Don't let the rules file (`CLAUDE.md`) go stale — if the tech stack or commands section is still marked "TBD," fill it in as soon as it's known rather than leaving it unfilled indefinitely.

## Immediate next steps once this session starts

1. Confirm the GitHub repo exists and is cloned — **created with the standard Node `.gitignore` template** (covers `node_modules/`, build output, `.env`, logs). Once M0's actual folder structure exists, append Expo-specific ignores (`.expo/`, `ios/`, `android/` — these appear once `expo prebuild` runs) and Vite's `dist/` — the Node template alone won't cover these.
2. Confirm `CLAUDE.md`, `BUILD_LOG.md`, and the full spec are all in the repo
3. Fill in `CLAUDE.md`'s "Project Facts" section (package manager, exact build/test/lint commands) once tooling is installed
4. Wait for explicit instruction before M0 scaffolding begins
