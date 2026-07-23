## ADDED Requirements

### Requirement: Async post-session extraction trigger
When a session transitions to `complete` via `/sessions/:id/end`, the system SHALL trigger exactly one asynchronous mining pass over that session's full transcript, without delaying or blocking the `/end` response, and without ever running during an in-progress session.

#### Scenario: Ending a session triggers mining without delaying the response
- **WHEN** a user ends an in-progress session
- **THEN** the `/end` response is returned without waiting for the mining pass to complete

#### Scenario: Mining never runs against an in-progress session
- **WHEN** a session has any status other than `complete`
- **THEN** no mining pass is triggered for that session

#### Scenario: A failed mining call does not affect session completion
- **WHEN** the mining pass for a completed session fails (e.g. API error)
- **THEN** the session's `complete` status is unaffected and no error is surfaced to the user

### Requirement: Structured signal extraction
The mining pass SHALL extract, per session, the following into `session_mining_results`: ownership-language presence, tradeoff-reasoning presence, tech/domain mentions, a clarity assessment, a sentiment assessment, growth signals, whether an outcome was mentioned (`outcome_mentioned`), and quoted quantified-impact phrases (`quantified_impact_examples[]`) drawn verbatim from the transcript, not paraphrased.

#### Scenario: Completed session produces a mining record
- **WHEN** the mining pass runs for a completed session
- **THEN** exactly one `session_mining_results` row is written for that session, containing all of the extracted fields

#### Scenario: Quantified-impact examples are verbatim quotes
- **WHEN** the transcript contains a quantified statement of impact (e.g. a specific metric or number tied to a decision)
- **THEN** `quantified_impact_examples[]` stores the real quoted phrase from the transcript, not a paraphrase or summary

### Requirement: Audience-aware keyword matching, anchor-gated
When a session is linked to an anchor with `target_role` set, the mining pass SHALL check the transcript against a curated role-language reference set for that role and store actual matched quotes in `audience_keyword_matches[]`. When no anchor is linked, or the linked anchor has no `target_role`, the mining pass SHALL NOT produce this field.

#### Scenario: Anchor-linked session with a matching role produces keyword matches
- **WHEN** a session is linked to an anchor with `target_role` set, and the transcript contains language matching that role's reference set
- **THEN** `audience_keyword_matches[]` contains the real quoted matching phrases from the transcript

#### Scenario: No anchor linked produces no audience keyword matches
- **WHEN** a session has no linked anchor
- **THEN** `audience_keyword_matches[]` is omitted from that session's mining result

#### Scenario: This is the only mining use of job_description_text
- **WHEN** the mining pass runs for a session linked to an anchor with `job_description_text` set
- **THEN** that field may be read by the mining pass, distinct from the live conversation (M2), which never reads it

### Requirement: Topic relevance scoring
The mining pass SHALL compute a `topic_relevance_score` for every session, reflecting how closely the transcript's subject matter matches ordinary career/professional-practice topics, for use by the fair-use entitlement check.

#### Scenario: Every mining result includes a topic relevance score
- **WHEN** the mining pass runs for any completed session
- **THEN** the resulting `session_mining_results` row includes a `topic_relevance_score`

### Requirement: No user-facing mining surface
Mining results SHALL never be included in any response returned to a client, and SHALL NOT be exposed as a score or grade anywhere in the product.

#### Scenario: Session-end response contains no mining data
- **WHEN** a user ends a session
- **THEN** the `/end` response contains no mining fields, scores, or extracted signals

### Requirement: Filler-word count is not fabricated
The mining pass SHALL NOT produce a `filler_word_count` value while the underlying speech-to-text integration strips disfluencies before they reach `transcript_turns`.

#### Scenario: Mining result contains no filler-word count
- **WHEN** the mining pass runs for a `voice`-mode session
- **THEN** the resulting `session_mining_results` row contains no fabricated `filler_word_count` value
