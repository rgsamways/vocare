## ADDED Requirements

### Requirement: Session capture mode
Each session SHALL record a `mode` of `voice` or `text`, chosen once when the session starts and not re-derived per turn, reflecting which input path was offered at session start.

#### Scenario: Mode is set at session start
- **WHEN** a user starts a new session
- **THEN** the session's `mode` is set to `voice` or `text` and does not change for the rest of that session

#### Scenario: Typed turns remain valid during a voice-mode session
- **WHEN** a session has `mode: voice` and the user submits a typed (not spoken) turn
- **THEN** the turn is accepted and persisted exactly as any other turn, and `mode` remains `voice`

### Requirement: Web voice input capture with typed-text parity
On web, the system SHALL offer a mic control that captures spoken input via the browser's native speech-recognition API when available, and SHALL keep the typed-text composer fully functional and first-class regardless of whether the mic control is available or used.

#### Scenario: Mic control available in a supporting browser
- **WHEN** a user opens the conversation screen in a browser exposing a working speech-recognition API
- **THEN** a mic control is shown alongside the text composer, and activating it populates the same composer text field with recognized speech

#### Scenario: Mic control absent in a non-supporting browser
- **WHEN** a user opens the conversation screen in a browser with no working speech-recognition API (e.g. Firefox)
- **THEN** no mic control is shown, and the text composer works exactly as it does for a `text`-mode session

#### Scenario: Speech recognition failure falls back to typed input without blocking the conversation
- **WHEN** speech recognition construction or activation fails (e.g. denied microphone permission, Safari PWA-context restriction)
- **THEN** the mic control becomes disabled and the text composer remains fully usable, with no error state that prevents the user from continuing the conversation
