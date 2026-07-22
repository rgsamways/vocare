## ADDED Requirements

### Requirement: Server-side-only entitlement verification
Every session start SHALL re-verify `entitlement_status` against an authenticated server call. No client-cached entitlement value SHALL be trusted as sufficient on its own.

#### Scenario: Cached client flag ignored when server entitlement is revoked
- **WHEN** a client presents a locally cached "paid" indicator but the server's stored `entitlement_status` is not paid
- **THEN** the system denies the session start based on the server value, not the client's cached value

### Requirement: Three free sessions, decremented at completion
Unpaid users SHALL receive 3 free sessions. The count of used free sessions SHALL be based on completed sessions, not sessions merely started.

#### Scenario: Unpaid user with sessions remaining can start a session
- **WHEN** an unpaid user who has completed fewer than 3 non-crisis-flagged sessions attempts to start a session
- **THEN** the system permits the session to start

#### Scenario: Unpaid user with no sessions remaining is blocked
- **WHEN** an unpaid user who has completed 3 non-crisis-flagged sessions attempts to start another session
- **THEN** the system blocks the session start and presents a message directing them to purchase

#### Scenario: Abandoned session does not consume a free session
- **WHEN** an unpaid user starts a session and closes it before completion
- **THEN** that session does not count toward their 3-session limit

### Requirement: Crisis-flagged sessions exempt from free-session count
A session flagged as a crisis session SHALL NOT count toward the 3-free-session limit.

#### Scenario: Crisis-flagged session does not decrement remaining count
- **WHEN** a session that was flagged as a crisis session completes
- **THEN** the user's count of remaining free sessions is unchanged

### Requirement: Undisclosed rolling-window fair-use velocity cap
The system SHALL enforce a rolling-window rate limit on session starts (a maximum per 24 hours and a maximum per 30 days), applied regardless of paid or unpaid status, without disclosing the specific numeric thresholds to the user.

#### Scenario: User exceeds the 24-hour cap
- **WHEN** a user attempts to start a session that would exceed the configured 24-hour session limit
- **THEN** the system blocks the session start and shows a plain in-app message that does not commit to a specific reset time

#### Scenario: User exceeds the 30-day cap
- **WHEN** a user attempts to start a session that would exceed the configured 30-day session limit
- **THEN** the system blocks the session start and shows the same plain in-app message

#### Scenario: Crisis-flagged sessions exempt from the velocity cap
- **WHEN** counting sessions toward the 24-hour or 30-day velocity cap for a given user
- **THEN** sessions flagged as crisis sessions are excluded from that count
