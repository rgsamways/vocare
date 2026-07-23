## ADDED Requirements

### Requirement: Anchor field edits are captured as revisions, not overwritten silently
When any of an anchor's `label`, `target_role`, `target_industry`, `job_description_text`, or `company` fields are edited, the system SHALL write an `anchor_revisions` row capturing the anchor's pre-edit values before applying the update to the live `anchors` row.

#### Scenario: Editing an anchor's target role writes a revision
- **WHEN** the anchor's owner submits an edit changing `target_role`
- **THEN** a new `anchor_revisions` row is written with the anchor's values from immediately before the edit, and the live `anchors` row reflects the new value

#### Scenario: An edit that changes no fields writes no revision
- **WHEN** the anchor's owner submits an edit request with no field values different from the current anchor
- **THEN** no new `anchor_revisions` row is written

### Requirement: Anchor archive and unarchive are state toggles, not revisions
The system SHALL allow an anchor's owner to set or clear `archived_at` independently of field edits, without writing an `anchor_revisions` row for the archive state change itself.

#### Scenario: Archiving an anchor sets archived_at
- **WHEN** the anchor's owner archives an anchor
- **THEN** the anchor's `archived_at` is set to the current time, and no `anchor_revisions` row is written for this action

#### Scenario: Unarchiving an anchor clears archived_at
- **WHEN** the anchor's owner unarchives a previously archived anchor
- **THEN** the anchor's `archived_at` is cleared, and no `anchor_revisions` row is written for this action

### Requirement: Anchor listing distinguishes active from archived
The system SHALL expose the caller's own anchors, defaulting to active (non-archived) anchors only, with an explicit option to include archived anchors.

#### Scenario: Default listing excludes archived anchors
- **WHEN** a user with both active and archived anchors requests their anchor list without requesting archived anchors
- **THEN** only active anchors are returned

#### Scenario: Explicit request includes archived anchors
- **WHEN** a user requests their anchor list with archived anchors included
- **THEN** both active and archived anchors are returned

### Requirement: Anchor revision history is retrievable in chronological order
The system SHALL expose an anchor's full revision history, ordered oldest to newest, so a user can see how their understanding of the goal shifted over time.

#### Scenario: Owner retrieves revision history for an edited anchor
- **WHEN** the anchor's owner requests the revision history for an anchor with two or more edits
- **THEN** the revisions are returned in chronological order, oldest first

#### Scenario: Owner retrieves revision history for a never-edited anchor
- **WHEN** the anchor's owner requests the revision history for an anchor that has never been edited since creation
- **THEN** an empty revision list is returned, not an error

### Requirement: All anchor management operations are ownership-checked
The system SHALL verify that the authenticated user owns the anchor before allowing any edit, archive, unarchive, or revision-history read, denying the request as if the anchor did not exist otherwise.

#### Scenario: Non-owner cannot edit another user's anchor
- **WHEN** a user submits an edit for an anchor they do not own
- **THEN** the request is denied as if the anchor did not exist

#### Scenario: Non-owner cannot read another user's anchor revision history
- **WHEN** a user requests the revision history for an anchor they do not own
- **THEN** the request is denied as if the anchor did not exist
