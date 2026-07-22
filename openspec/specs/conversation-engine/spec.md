# conversation-engine Specification

## Purpose
TBD - created by archiving change m2-conversation-engine. Update Purpose after archive.
## Requirements
### Requirement: Open-ended, non-technical question arc
The system SHALL drive the conversation via a system prompt that asks open-ended, non-technical questions following a past/present/future arc, and SHALL NOT surface scores, grades, or evaluative language at any point during the session.

#### Scenario: Session opens with an open-ended prompt
- **WHEN** a user starts a new session
- **THEN** the first assistant turn is an open-ended, non-technical question and contains no score, grade, or evaluative language

#### Scenario: No evaluative language mid-session
- **WHEN** the assistant generates any turn during an in-progress session
- **THEN** the turn contains no numeric score, letter grade, or evaluative judgment of the user's answer

### Requirement: Adaptive follow-up on vague answers
The system SHALL detect vague or non-specific user answers and prompt for one concrete detail, without escalating into a multi-question technical quiz.

#### Scenario: Vague answer prompts for specifics
- **WHEN** a user gives a vague, non-specific answer (e.g. "I worked on some stuff at my old job")
- **THEN** the assistant's next turn asks for one concrete detail related to that answer, not a list of technical questions

#### Scenario: Specific answer does not trigger a probe
- **WHEN** a user gives a specific, detailed answer
- **THEN** the assistant's next turn advances the conversation rather than probing for more detail on the same point

### Requirement: Session state machine
Each session SHALL move through the states `start`, `in-progress`, and `complete`, and SHALL NOT skip a state.

#### Scenario: New session starts in the start state
- **WHEN** a user starts a new session
- **THEN** the session's status is `start`

#### Scenario: First turn transitions to in-progress
- **WHEN** the first conversational turn is exchanged in a session with status `start`
- **THEN** the session's status becomes `in-progress`

#### Scenario: Ending a session transitions to complete
- **WHEN** a user ends an in-progress session
- **THEN** the session's status becomes `complete` and `completed_at` is set

### Requirement: Anchor-aware live steering, restricted to light fields only
When a session is linked to an anchor, the system SHALL read only that anchor's `target_role` and `target_industry` fields live to steer tone and emphasis. The system SHALL NOT read `job_description_text` or `company` at any point during the session.

#### Scenario: Anchor-linked session steers using target_role/target_industry
- **WHEN** a session is linked to an anchor with `target_role` and `target_industry` set
- **THEN** the conversation's tone/emphasis reflects those fields (e.g. a backend-infra role is asked about technical tradeoffs)

#### Scenario: job_description_text and company are never read live
- **WHEN** a session is linked to an anchor with `job_description_text` and `company` set
- **THEN** neither field is included in any prompt or request sent during the live conversation

#### Scenario: No anchor linked falls back to the generic arc
- **WHEN** a session has no linked anchor
- **THEN** the conversation follows the generic past/present/future arc with no role/industry-specific steering

### Requirement: Minimal anchor creation
A user SHALL be able to create an anchor with `label`, `target_role`, `target_industry`, `job_description_text`, and `company` fields, all optional except `label`, reachable from session start.

#### Scenario: User creates an anchor and links it to a session
- **WHEN** a user creates an anchor with at least a label and links it to a new session
- **THEN** the anchor is persisted and the session's `anchor_id` references it

### Requirement: Topic-seed suggestion chips
At session start, the system SHALL offer a small set of broad, non-interview-specific, tappable topic-seed suggestions. These SHALL disappear once the conversation starts, and freeform input SHALL remain available regardless of whether a chip is used.

#### Scenario: Chips shown before the conversation starts
- **WHEN** a user starts a new session with status `start`
- **THEN** the session-start response includes a small set of broad topic-seed suggestions

#### Scenario: Chips are anchor-aware when an anchor is linked
- **WHEN** a user starts a session linked to an anchor with `target_role`/`target_industry` set
- **THEN** the returned topic-seed suggestions reflect that anchor's light fields

#### Scenario: Freeform input available regardless of chips
- **WHEN** a session is at status `start` with topic-seed suggestions shown
- **THEN** the user can submit freeform text instead of selecting a suggestion

### Requirement: Upfront qualitative time expectation
The system SHALL show a qualitative time expectation once at session start, and SHALL NOT display a live countdown or assert a specific numeric duration.

#### Scenario: Time expectation shown once at start
- **WHEN** a user starts a new session
- **THEN** the session-start response includes qualitative time-expectation copy (e.g. "no need to rush")

#### Scenario: No live countdown during the session
- **WHEN** a session is in progress
- **THEN** no turn or response includes a running timer or countdown

### Requirement: Visible redirect agency
The system SHALL provide a control, usable at any point in an in-progress session, that lets the user redirect the conversation to a different topic without resetting the session.

#### Scenario: User invokes the redirect control
- **WHEN** a user activates the redirect control during an in-progress session
- **THEN** the next assistant turn pivots to a different topic and the session's existing transcript and status are unchanged

### Requirement: Optional text-only AI persona properties
The system SHALL support varying the AI conversational partner's age-range and gender-presentation framing via system-prompt text only, with no dependency on voice or text-to-speech. The system SHALL support both an automatic-variation mode (default) and a user-selected mode, and SHALL NOT vary ethnicity or accent.

#### Scenario: Auto-vary mode selects a persona at session start
- **WHEN** a user starts a session without explicitly selecting persona properties
- **THEN** the system selects an age-range/gender-presentation combination for that session and applies it via system-prompt framing only

#### Scenario: User-selected persona is honored for the whole session
- **WHEN** a user selects specific age-range/gender-presentation properties before starting a session
- **THEN** every assistant turn in that session reflects the selected properties, and the properties do not change mid-session

#### Scenario: Persona selection never includes ethnicity or accent
- **WHEN** a user is offered persona properties to select, or the system auto-varies them
- **THEN** no ethnicity or accent option is offered or auto-selected

### Requirement: Full transcript persistence
Every conversational turn, including redirect-control invocations, SHALL be persisted to `transcript_turns` in the order it occurred.

#### Scenario: Every turn is stored
- **WHEN** a user or assistant turn occurs during a session
- **THEN** a corresponding row is written to `transcript_turns` with the correct `session_id`, `speaker`, `content`, and timestamp

#### Scenario: Redirect invocation is recorded
- **WHEN** a user activates the redirect control
- **THEN** that action is recorded in `transcript_turns` as part of the session's honest record

