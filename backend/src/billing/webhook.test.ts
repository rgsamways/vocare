import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { buildApp } from "../app.js";
import { db, schema } from "../db/client.js";

const WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests";
const TEST_USER_ID = "webhook-test-user";
const TEST_EMAIL = "webhook-test@example.com";
const PAYMENT_INTENT_ID = "pi_test_123";

const stripe = new Stripe("sk_test_unused");

function signedPayload(payload: object) {
  const body = JSON.stringify(payload);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: WEBHOOK_SECRET,
  });
  return { body, signature };
}

async function cleanup() {
  await db.delete(schema.stripePayments).where(eq(schema.stripePayments.userId, TEST_USER_ID));
  await db.delete(schema.stripeWebhookEvents).where(eq(schema.stripeWebhookEvents.eventId, "evt_checkout_test"));
  await db.delete(schema.stripeWebhookEvents).where(eq(schema.stripeWebhookEvents.eventId, "evt_dispute_test"));
  await db.delete(schema.user).where(eq(schema.user.id, TEST_USER_ID));
}

describe("Stripe webhook", () => {
  beforeAll(() => {
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values({
      id: TEST_USER_ID,
      name: "",
      email: TEST_EMAIL,
      emailVerified: true,
      entitlementStatus: "unpaid",
      dateOfBirth: new Date("1990-01-01"),
      country: "Canada",
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  it("rejects a request with an invalid signature and makes no entitlement change", async () => {
    const app = buildApp();
    const { body } = signedPayload({
      id: "evt_invalid_sig_test",
      type: "checkout.session.completed",
      data: { object: { client_reference_id: TEST_USER_ID, payment_intent: PAYMENT_INTENT_ID } },
    });

    const res = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
      payload: body,
    });

    expect(res.statusCode).toBe(400);
    const [user] = await db.select().from(schema.user).where(eq(schema.user.id, TEST_USER_ID));
    expect(user.entitlementStatus).toBe("unpaid");
  });

  it("rejects a request with a missing signature header", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ id: "evt_no_sig", type: "checkout.session.completed" }),
    });
    expect(res.statusCode).toBe(400);
  });

  it("flips entitlement to paid on checkout.session.completed with a valid signature", async () => {
    const app = buildApp();
    const { body, signature } = signedPayload({
      id: "evt_checkout_test",
      type: "checkout.session.completed",
      data: { object: { client_reference_id: TEST_USER_ID, payment_intent: PAYMENT_INTENT_ID } },
    });

    const res = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "content-type": "application/json", "stripe-signature": signature },
      payload: body,
    });

    expect(res.statusCode).toBe(200);

    const [user] = await db.select().from(schema.user).where(eq(schema.user.id, TEST_USER_ID));
    expect(user.entitlementStatus).toBe("paid");
    expect(user.paidAt).not.toBeNull();

    const [payment] = await db
      .select()
      .from(schema.stripePayments)
      .where(eq(schema.stripePayments.paymentIntentId, PAYMENT_INTENT_ID));
    expect(payment.userId).toBe(TEST_USER_ID);
  });

  it("processes a duplicate event.id exactly once (idempotent replay)", async () => {
    const app = buildApp();
    const { body, signature } = signedPayload({
      id: "evt_checkout_test",
      type: "checkout.session.completed",
      data: { object: { client_reference_id: TEST_USER_ID, payment_intent: PAYMENT_INTENT_ID } },
    });

    const first = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "content-type": "application/json", "stripe-signature": signature },
      payload: body,
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "content-type": "application/json", "stripe-signature": signature },
      payload: body,
    });
    expect(second.statusCode).toBe(200);

    const events = await db
      .select()
      .from(schema.stripeWebhookEvents)
      .where(eq(schema.stripeWebhookEvents.eventId, "evt_checkout_test"));
    expect(events).toHaveLength(1);

    const payments = await db
      .select()
      .from(schema.stripePayments)
      .where(eq(schema.stripePayments.paymentIntentId, PAYMENT_INTENT_ID));
    expect(payments).toHaveLength(1);
  });

  it("revokes entitlement back to unpaid on charge.dispute.created", async () => {
    const app = buildApp();

    const checkout = signedPayload({
      id: "evt_checkout_test",
      type: "checkout.session.completed",
      data: { object: { client_reference_id: TEST_USER_ID, payment_intent: PAYMENT_INTENT_ID } },
    });
    await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "content-type": "application/json", "stripe-signature": checkout.signature },
      payload: checkout.body,
    });

    const dispute = signedPayload({
      id: "evt_dispute_test",
      type: "charge.dispute.created",
      data: { object: { payment_intent: PAYMENT_INTENT_ID } },
    });
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "content-type": "application/json", "stripe-signature": dispute.signature },
      payload: dispute.body,
    });

    expect(res.statusCode).toBe(200);
    const [user] = await db.select().from(schema.user).where(eq(schema.user.id, TEST_USER_ID));
    expect(user.entitlementStatus).toBe("unpaid");
  });
});
