## ADDED Requirements

### Requirement: Sign-up only offers countries with a real, verified resource
The sign-up country selector SHALL only offer countries that have a real, individually-verified entry in the crisis-resource map. A country SHALL NOT be offered as a choice solely on the basis of being a plausible or common market — it must have an actual backing resource.

#### Scenario: Every dropdown country has a real resource
- **WHEN** a country appears in the sign-up country selector
- **THEN** that country has a non-generic entry in the crisis-resource map

#### Scenario: A country with no verified resource is not offered
- **WHEN** a country has been researched and found to have no single, clean, verifiable national crisis resource
- **THEN** that country does not appear in the sign-up country selector, and a user from that country selects the closest fit or "Other" instead
