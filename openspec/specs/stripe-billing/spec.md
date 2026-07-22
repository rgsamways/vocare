# stripe-billing Specification

## Purpose
TBD - created by archiving change m1-auth-entitlement. Update Purpose after archive.
## Requirements
### Requirement: One-time $29 USD Stripe Checkout
The system SHALL offer a $29 USD one-time payment (Stripe Checkout, `mode: "payment"`) on the web app that unlocks unlimited entitlement upon successful completion. The mobile app SHALL never initiate a purchase.

#### Scenario: Successful checkout unlocks entitlement
- **WHEN** a user completes a Stripe Checkout session successfully
- **THEN** the system's webhook handler flips that user's `entitlement_status` to paid

#### Scenario: Mobile app never initiates a purchase
- **WHEN** a user views the paywall on the Android app
- **THEN** no in-app purchase flow is presented; the app directs the user to the website to pay

### Requirement: Webhook signature verification on raw request body
The webhook endpoint SHALL verify the Stripe signature against the raw, unparsed request body. Requests with an invalid or missing signature SHALL be rejected without any entitlement change.

#### Scenario: Valid signature processed
- **WHEN** the webhook endpoint receives a request with a valid Stripe signature over the raw body
- **THEN** the system processes the event

#### Scenario: Invalid signature rejected
- **WHEN** the webhook endpoint receives a request with a missing or invalid signature
- **THEN** the system rejects the request and makes no change to any user's `entitlement_status`

### Requirement: Idempotent webhook processing
The webhook handler SHALL process each Stripe event exactly once, keyed by `event.id`, even if Stripe delivers the same event multiple times.

#### Scenario: Duplicate event delivered twice
- **WHEN** the webhook endpoint receives two requests carrying the same `event.id`
- **THEN** the system applies the event's effect only once and returns success on the duplicate without reprocessing

### Requirement: Dispute revokes entitlement
A `charge.dispute.created` event SHALL revoke the affected user's `entitlement_status` back to unpaid.

#### Scenario: Chargeback revokes access
- **WHEN** the webhook endpoint receives a `charge.dispute.created` event for a user's charge
- **THEN** that user's `entitlement_status` is set back to unpaid

### Requirement: No self-service refunds
The system SHALL provide no automated or self-service refund mechanism distinct from dispute handling; all sales are final per the stated policy.

#### Scenario: User requests a refund outside of a dispute
- **WHEN** a user asks for a refund through any in-product channel
- **THEN** the system takes no automated action to reverse the charge or revoke entitlement (only an actual bank-initiated dispute triggers the dispute-handling requirement above)

