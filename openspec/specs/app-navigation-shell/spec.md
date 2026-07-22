# app-navigation-shell Specification

## Purpose
TBD - created by archiving change 2026-07-22-m2.1-app-navigation-shell. Update Purpose after archive.
## Requirements
### Requirement: Persistent tab bar for signed-in users
The system SHALL render a bottom tab bar with exactly four destinations — Conversation, Feedback, Progress & Anchors, Profile — for any signed-in user, and SHALL NOT render it for a signed-out visitor.

#### Scenario: Signed-in user sees the tab bar
- **WHEN** a signed-in user views `/account`, `/practice`, `/feedback`, or `/progress`
- **THEN** the bottom tab bar renders with all four tabs, and the tab matching the current route is styled as active

#### Scenario: Signed-out visitor sees no tab bar
- **WHEN** a signed-out visitor is redirected away from a tab-bar-wrapped route
- **THEN** no tab bar renders at any point during that redirect

### Requirement: Sign-up and paywall stay outside the shell
The system SHALL NOT wrap the sign-up screen or the paywall screen in the tab-bar shell.

#### Scenario: Sign-up has no tab bar
- **WHEN** a visitor views `/`
- **THEN** no tab bar renders

#### Scenario: Paywall has no tab bar
- **WHEN** a signed-in user views `/paywall`
- **THEN** no tab bar renders

### Requirement: Not-yet-built destinations render a placeholder
The system SHALL provide real, reachable routes for Feedback and Progress & Anchors that render a plain "coming soon" state until M5 and M6 are built.

#### Scenario: Feedback tab shows a coming-soon state
- **WHEN** a signed-in user navigates to `/feedback`
- **THEN** the page renders without error and displays coming-soon copy, not a 404 or blank page

#### Scenario: Progress & Anchors tab shows a coming-soon state
- **WHEN** a signed-in user navigates to `/progress`
- **THEN** the page renders without error and displays coming-soon copy, not a 404 or blank page

