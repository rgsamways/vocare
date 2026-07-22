## ADDED Requirements

### Requirement: Passwordless magic-link sign-in
The system SHALL authenticate users via a magic link sent to their email address. No password field SHALL exist anywhere in the sign-up or sign-in flow, and no OAuth provider SHALL be offered at launch.

#### Scenario: User requests a magic link
- **WHEN** a user submits a valid email address on the sign-in screen
- **THEN** the system sends a single-use magic-link email to that address and does not create a session yet

#### Scenario: User completes sign-in via a valid magic link
- **WHEN** a user clicks a magic link within its validity window and it has not been used before
- **THEN** the system authenticates the user and issues a session

#### Scenario: Expired or already-used magic link is rejected
- **WHEN** a user clicks a magic link that has expired or was already consumed
- **THEN** the system rejects the attempt and does not issue a session

#### Scenario: No password path exists
- **WHEN** a user views the sign-up or sign-in screen
- **THEN** no password input field is present anywhere in the flow

### Requirement: 30-day sliding session
Sessions SHALL remain valid for 30 days from the last activity, with the expiration refreshed on each authenticated request, rather than a fixed expiration from sign-in time.

#### Scenario: Successful sign-in issues a 30-day session
- **WHEN** a user completes magic-link verification
- **THEN** the system issues a session (secure cookie on web, equivalent secure token on Expo) valid for 30 days from that moment

#### Scenario: Activity refreshes the session window
- **WHEN** an authenticated user makes a request before their session expires
- **THEN** the session's expiration is extended to 30 days from that request

#### Scenario: Session lapses after 30 days of inactivity
- **WHEN** a user makes no authenticated request for 30 consecutive days
- **THEN** the session is no longer valid and the user must request a new magic link

### Requirement: Age gate at sign-up
The system SHALL collect the user's date of birth at sign-up and SHALL block sign-up for users below the configured minimum age.

#### Scenario: Sign-up collects date of birth
- **WHEN** a user completes the sign-up flow
- **THEN** their date of birth has been captured and stored

#### Scenario: Sign-up blocked below minimum age
- **WHEN** a user enters a date of birth indicating an age below the configured minimum
- **THEN** the system blocks sign-up completion and does not create an account

### Requirement: Country capture at sign-up
The system SHALL capture the user's country at sign-up, defaulting to a value derived from the browser locale, editable by the user before submission.

#### Scenario: Country field defaults from browser locale
- **WHEN** a user reaches the sign-up screen
- **THEN** the country field is pre-filled with a best-guess value derived from the browser's locale setting

#### Scenario: User overrides the detected country
- **WHEN** a user selects a different country than the pre-filled default
- **THEN** the system stores the user's selected value, not the default
