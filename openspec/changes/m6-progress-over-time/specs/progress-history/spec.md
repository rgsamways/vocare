## ADDED Requirements

### Requirement: Session history is listable and rereadable in full
The system SHALL expose the caller's own completed sessions as a list, and each one individually with its full `transcript_turns` and its `feedback_reports` entry, not only its position in a trend.

#### Scenario: User lists their completed sessions
- **WHEN** a user with completed sessions requests their session history
- **THEN** their completed sessions are returned, most recent first

#### Scenario: User opens a past session's full detail
- **WHEN** a user requests detail for one of their own completed sessions
- **THEN** that session's full transcript and its feedback report are returned together

#### Scenario: Incomplete sessions are excluded from history
- **WHEN** a user has both completed and in-progress sessions
- **THEN** only completed sessions appear in their session history list

### Requirement: Non-owner cannot read another user's session history
The system SHALL deny access to a session's history detail for any user other than its owner, as if the session did not exist.

#### Scenario: Non-owner requests another user's session detail
- **WHEN** a user requests session detail for a session they do not own
- **THEN** the request is denied as if the session did not exist

### Requirement: Tradeoff-reasoning trend compares against 3 completed sessions back
The system SHALL report whether `tradeoff_reasoning_present` differs between the user's most recent completed session and the completed session exactly 3 before it, in plain, non-judgmental, developmental language, omitting the trend entirely when fewer than 4 completed sessions exist.

#### Scenario: Trend reports newly-present tradeoff reasoning
- **WHEN** a user has at least 4 completed sessions and their most recent session has `tradeoff_reasoning_present: true` while the session 3 before it has `tradeoff_reasoning_present: false`
- **THEN** the trend response reports the improvement in plain, non-scored language

#### Scenario: Trend reports newly-absent tradeoff reasoning
- **WHEN** a user has at least 4 completed sessions and their most recent session has `tradeoff_reasoning_present: false` while the session 3 before it has `tradeoff_reasoning_present: true`
- **THEN** the trend response reports the decline in the same plain, non-judgmental register as the improvement case, not silence

#### Scenario: Trend omitted with insufficient history
- **WHEN** a user has fewer than 4 completed sessions
- **THEN** the tradeoff-reasoning trend is omitted from the response entirely

### Requirement: Audience-alignment trend is scoped per anchor and requires anchor linkage
The system SHALL report the change in `audience_keyword_matches[]` count between the user's most recent completed session linked to a given anchor and the completed session linked to that same anchor exactly 3 before it, omitting the trend when fewer than 4 qualifying sessions exist for that anchor or when either session's `audience_keyword_matches` is null.

#### Scenario: Audience-alignment trend reports improvement for a linked anchor
- **WHEN** a user has at least 4 completed sessions linked to the same anchor, and the most recent has more `audience_keyword_matches[]` entries than the session 3 before it
- **THEN** the trend response reports the improvement, scoped to that anchor

#### Scenario: Audience-alignment trend reports decline for a linked anchor
- **WHEN** a user has at least 4 completed sessions linked to the same anchor, and the most recent has fewer `audience_keyword_matches[]` entries than the session 3 before it
- **THEN** the trend response reports the decline in the same plain register as the improvement case

#### Scenario: No anchor linkage produces no audience-alignment trend
- **WHEN** a user's recent sessions have no linked anchor
- **THEN** no audience-alignment trend is included in the response, and nothing states that no anchor was set

### Requirement: No filler-word trend is reported
The system SHALL NOT report a filler-word trend, since no filler-word signal exists in `session_mining_results`.

#### Scenario: Trend response contains no filler-word entry
- **WHEN** a user requests their progress trends
- **THEN** the response contains no filler-word trend entry, for any user

### Requirement: Trend and history views are accessible without a visual-only equivalent
Every trend indicator and history element SHALL be exposed as text content navigable via screen reader, with no information conveyed only through color, icon, or chart.

#### Scenario: Trend direction is conveyed in text
- **WHEN** a trend is rendered, in either direction
- **THEN** the direction and its plain-language description are present as readable text, not only as a visual indicator
