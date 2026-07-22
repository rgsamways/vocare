## Why

M2/M3 give Vocare a complete, judgment-free practice conversation, but nothing yet turns a finished session into structured signal. M5 (coaching feedback) and M6 (progress trend) both need that signal to exist before either can be built, and Section 17's fair-use abuse-detection proposal (a session far outside normal career topics as a throttling signal) has been sitting as prose in the spec, unwired into M1's actual entitlement logic. This change builds the extraction pass itself — a separate, async LLM call over a completed transcript only, keeping the live conversation phase (M2/M3) exactly as judgment-free as it is today.

## What Changes

- New async mining pass, triggered from `POST /sessions/:id/end` after the session is marked `complete`: a single Haiku 4.5 call over the full transcript, extracting ownership language, tradeoff-reasoning presence, tech/domain mentions, clarity, sentiment, growth signals, `outcome_mentioned`, and `quantified_impact_examples[]` (real quoted phrases, not paraphrases).
- New `audience_keyword_matches[]` field: when the session's anchor has `target_role` set, the mining pass checks the transcript against a small curated role-language reference set (new build — this library doesn't exist yet) and stores actual matched quotes, not just a count. This is the only place `job_description_text` is ever read for this purpose (M2 never reads it live, per its own spec).
- New `topic_relevance_score`, actually wired into M1's `checkEntitlement`/velocity-cap logic (not just stored inertly, per Section 17): a session scored as off-topic marks the user for stricter fair-use review going forward. Exact mechanism (flag field + how `entitlement.ts` reads it) is design.md's call, not decided in this proposal.
- `filler_word_count` is explicitly **not built** as real counting logic. M3's own manual verification confirmed the Web Speech API strips "um"/"uh" before text reaches `transcript_turns` — the signal this field would count from doesn't exist at the point M4 reads the transcript. The field is stored as an explicit, flagged non-value (e.g. `null` with a reason), not a fabricated count.
- New `session_mining_results` table (per spec Section 3) — one row per completed session, never written back as a user-facing score anywhere.
- Trigger designed so the pass runs immediately per-session (decided 2026-07-21) but swapping to the Batch API later doesn't require touching M2/M3's own code — the mining call is invoked from a single seam in the `/end` route, not scattered across the conversation flow.
- **Explicitly out of scope:** the personal practice-word dictionary extension to `audience_keyword_matches[]` (parked in Section 24 until M5 exists); any user-facing surface for mining results (that's M5); the M7 anonymization/aggregation pipeline itself.

## Capabilities

### New Capabilities
- `session-mining`: the post-session extraction pipeline — trigger, extraction schema, storage, and the explicit non-value handling for filler-word count.

### Modified Capabilities
- `session-entitlement`: `checkEntitlement`'s fair-use logic gains a topic-relevance signal sourced from mining results, extending (not replacing) the existing velocity-cap/paywall checks.

## Impact

- `backend/src/db/schema.ts`: new `session_mining_results` table + migration (production migration via Postgres's public proxy, per CLAUDE.md's Deployment note — **rule-5 sensitive**, and per CLAUDE.md's 2026-07-22 extension, M4 as a whole gets the two-instance chat/cli review this proposal is itself part of).
- `backend/src/routes/conversation.ts`: `/sessions/:id/end` gains a fire-and-forget call into the new mining module after marking the session complete.
- New `backend/src/mining/` module: extraction prompt/schema, the role-language reference library, the Anthropic call, and the `session_mining_results` write.
- `backend/src/entitlement/entitlement.ts`: `checkEntitlement` reads the topic-relevance signal alongside the existing velocity/paywall checks.
- No changes to M2/M3's live conversation code paths or to crisis-safety logic — mining reads a completed transcript only, after the fact.
- Cost/caching verification against real M1–M3 production usage (Anthropic Console) before assuming this fits the spec's <$0.05/session ceiling — a verification task, not a design decision, see design.md.
