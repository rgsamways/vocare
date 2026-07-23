## ADDED Requirements

### Requirement: Topic-relevance abuse signal extends the fair-use check
The system SHALL count, per user within the existing rolling 24h/30d windows, sessions whose mining result `topic_relevance_score` falls below a configured off-topic threshold. When that count crosses a configured threshold, `checkEntitlement` SHALL deny the next session start using the existing undisclosed velocity-cap message, without disclosing that the denial is topic-related.

#### Scenario: Repeated off-topic sessions trigger denial on a later session start
- **WHEN** a user's count of below-threshold `topic_relevance_score` sessions within the rolling windows meets or exceeds the configured threshold
- **THEN** the system denies that user's next session start with the existing velocity-cap message

#### Scenario: Ordinary on-topic usage is unaffected
- **WHEN** a user has no sessions below the off-topic threshold in the rolling windows
- **THEN** this check has no effect on `checkEntitlement`'s outcome for that user

#### Scenario: The denial message does not distinguish this signal from the ordinary velocity cap
- **WHEN** a session start is denied because of the topic-relevance signal
- **THEN** the message shown is identical to the ordinary velocity-cap denial message

#### Scenario: A session with no mining result yet does not count toward this signal
- **WHEN** a session is completed but its mining pass has not yet written a `session_mining_results` row
- **THEN** that session is not counted toward the off-topic threshold until a mining result exists
