## ADDED Requirements

### Requirement: Feedback report generation, chained off mining
When a session's `session_mining_results` row is successfully written, the system SHALL generate exactly one `feedback_reports` row for that session, derived deterministically from the mining result, without any additional LLM call.

#### Scenario: A completed, mined session produces a feedback report
- **WHEN** the mining pass for a completed session succeeds
- **THEN** exactly one `feedback_reports` row is written for that session

#### Scenario: A failed mining pass produces no feedback report
- **WHEN** the mining pass for a completed session fails or is skipped
- **THEN** no `feedback_reports` row is written for that session, and no error is surfaced to the user

### Requirement: Coaching notes quote the user's real words
Where the session's mining result contains a specific supporting line (`quantifiedImpactExamples[]` or `audienceKeywordMatches[]`), the generated report SHALL include the real quoted phrase from that field, not a paraphrase or invented quote.

#### Scenario: Quantified-impact example is quoted verbatim
- **WHEN** a session's mining result has a non-empty `quantifiedImpactExamples[]`
- **THEN** the generated report includes at least one note containing a verbatim entry from `quantifiedImpactExamples[]`

#### Scenario: Audience keyword match is quoted verbatim
- **WHEN** a session's mining result has a non-null, non-empty `audienceKeywordMatches[]`
- **THEN** the generated report includes at least one note containing a verbatim entry from `audienceKeywordMatches[]`

### Requirement: No-match cases render as a normal, complete report
A session whose mining result has `audienceKeywordMatches` null, or empty arrays for quote-bearing fields, SHALL produce a complete report that omits the corresponding note category, without any note stating that nothing was found.

#### Scenario: No linked anchor produces no audience-keyword note, and no complaint about it
- **WHEN** a session's mining result has `audienceKeywordMatches` set to null
- **THEN** the generated report contains no audience-keyword note, and no note stating that no match was found

#### Scenario: Every report has at least one note
- **WHEN** a session's mining result has no fields present for any note category
- **THEN** the generated report still contains at least one note (a fixed, generic closing note)

### Requirement: No numeric score in any coaching note
The report generation function SHALL NOT accept `topicRelevanceScore` as an input, and no note in any generated report SHALL contain a numeric score, grade, or percentage tied to the user's performance.

#### Scenario: Report generation input excludes topic relevance score
- **WHEN** a feedback report is generated from a session's mining result
- **THEN** the function generating it is not given `topicRelevanceScore` as part of its input

#### Scenario: No note contains a performance score
- **WHEN** a feedback report is generated for any session
- **THEN** none of its notes contain a numeric score, grade, or percentage describing the user's performance

### Requirement: Feedback report retrieval, ownership-checked
The system SHALL expose the caller's own session's feedback report via an authenticated, ownership-checked endpoint, distinguishing a not-yet-ready report from a nonexistent or unowned session.

#### Scenario: Owner retrieves a ready report
- **WHEN** the session's owner requests that session's feedback report and a `feedback_reports` row exists
- **THEN** the report is returned

#### Scenario: Owner requests feedback before mining completes
- **WHEN** the session's owner requests that session's feedback report before a `feedback_reports` row exists for a `complete` session
- **THEN** a pending status is returned, not an error

#### Scenario: Non-owner cannot retrieve another user's report
- **WHEN** a user requests a feedback report for a session they do not own
- **THEN** the request is denied as if the session did not exist

### Requirement: Latest feedback report lookup
The system SHALL expose an endpoint returning the caller's most recently completed session's feedback report, for entry points with no specific session in context.

#### Scenario: User with a completed session retrieves their latest report
- **WHEN** a user with at least one completed, mined session requests their latest feedback report
- **THEN** the report for their most recently completed session is returned

#### Scenario: User with no completed sessions gets a none state
- **WHEN** a user with no completed sessions requests their latest feedback report
- **THEN** a "none" status is returned, not an error

### Requirement: Accessible feedback report rendering
The feedback report page SHALL render coaching notes as semantic HTML with proper heading structure and ARIA labeling, such that all report content is navigable via screen reader.

#### Scenario: Report content uses semantic structure
- **WHEN** a feedback report is rendered
- **THEN** its heading and notes use semantic HTML elements, not meaning conveyed by visual styling alone

#### Scenario: Pending and empty states are announced accessibly
- **WHEN** a feedback report is in a pending or none state
- **THEN** the rendered message is exposed to assistive technology, not only conveyed visually
