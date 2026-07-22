# crisis-safety-net Specification

## Purpose
TBD - created by archiving change m2-conversation-engine. Update Purpose after archive.
## Requirements
### Requirement: Live, per-turn crisis-language check
The system SHALL run a crisis-language check on every user turn, live and synchronously as part of that turn's response cycle, independent of and in addition to the conversation's normal flow. This check SHALL NOT be deferred to any async or post-session process.

#### Scenario: Check runs on every user turn
- **WHEN** a user submits a turn during an in-progress session
- **THEN** the crisis-language check runs against that turn before or alongside generating the conversational reply, within the same response cycle

#### Scenario: Check is not deferred to post-session processing
- **WHEN** a session completes
- **THEN** the crisis-language check has already run against every user turn in that session, not as part of any post-session pass

### Requirement: Narrow scope — explicit self-harm/acute-crisis language only
The check SHALL trigger only for explicit self-harm or acute-crisis language. Ordinary career-stress venting, frustration, anxiety, or burnout SHALL NOT trigger it.

#### Scenario: Ordinary career-stress venting does not trigger
- **WHEN** a user expresses frustration, anxiety, or burnout about their career or job search
- **THEN** the crisis-safety card is not shown and `crisis_flagged` is not set

#### Scenario: Explicit self-harm/acute-crisis language triggers
- **WHEN** a user's turn contains explicit self-harm or acute-crisis language
- **THEN** the crisis-safety card is shown and `crisis_flagged` is set on that session

### Requirement: Immediate, visible, inline resource surfacing
When the check triggers, the system SHALL surface crisis resources immediately and visibly, inline in the conversation, sourced by the user's `country`.

#### Scenario: Resource card shown inline on trigger
- **WHEN** the crisis-language check triggers on a user turn
- **THEN** a crisis-resource card is shown inline in the conversation in the same response cycle, before any further conversational turn

#### Scenario: Resource sourced by user's country
- **WHEN** the crisis-language check triggers for a user whose `country` is set
- **THEN** the resource shown corresponds to that country, not a single generic default

#### Scenario: Resource falls back for an unrecognized country
- **WHEN** the crisis-language check triggers for a user whose `country` has no specific matching resource configured
- **THEN** a generic fallback resource is shown rather than no resource at all

### Requirement: crisis_flagged set the instant the check fires
The system SHALL set `sessions.crisis_flagged` to true the instant the crisis-language check triggers, live, not deferred to any later processing step.

#### Scenario: Flag set immediately on trigger
- **WHEN** the crisis-language check triggers during an in-progress session
- **THEN** `sessions.crisis_flagged` is set to true before the response cycle for that turn completes

#### Scenario: Flag persists for the remainder of the session
- **WHEN** a session has `crisis_flagged` set to true and the conversation continues
- **THEN** `crisis_flagged` remains true regardless of subsequent turns

### Requirement: Redirect control cannot suppress a triggered safety response
The redirect-agency control SHALL NOT dismiss, hide, or suppress a triggered crisis-safety card. The safety card SHALL remain visible regardless of any redirect action.

#### Scenario: Redirect invoked after a trigger does not hide the safety card
- **WHEN** a user activates the redirect control in a session where the crisis-safety card is currently shown
- **THEN** the safety card remains visible and is not dismissed by the redirect action

#### Scenario: Redirect does not prevent a safety card from appearing
- **WHEN** a user's turn both requests a topic redirect and contains explicit self-harm/acute-crisis language
- **THEN** the crisis-safety card is shown, independent of the redirect request

### Requirement: Sign-up only offers countries with a real, verified resource
The sign-up country selector SHALL only offer countries that have a real, individually-verified entry in the crisis-resource map. A country SHALL NOT be offered as a choice solely on the basis of being a plausible or common market — it must have an actual backing resource.

#### Scenario: Every dropdown country has a real resource
- **WHEN** a country appears in the sign-up country selector
- **THEN** that country has a non-generic entry in the crisis-resource map

#### Scenario: A country with no verified resource is not offered
- **WHEN** a country has been researched and found to have no single, clean, verifiable national crisis resource
- **THEN** that country does not appear in the sign-up country selector, and a user from that country selects the closest fit or "Other" instead

