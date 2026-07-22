import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";

function isUniqueViolation(err: unknown): boolean {
  const cause = (err as { cause?: { code?: string } } | undefined)?.cause;
  return cause?.code === "23505";
}

function getStripe() {
  // Signature verification is a local HMAC check — it never calls the Stripe API — but
  // the SDK still requires a non-empty apiKey string just to construct the client.
  return new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_unused_by_webhooks");
}

/**
 * Its own encapsulated plugin with a scoped raw-buffer content-type parser —
 * Stripe's signature check needs the exact raw bytes it signed, and this
 * must never affect any other route's normal JSON parsing (see design.md).
 */
export async function stripeWebhookPlugin(fastify: FastifyInstance) {
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_request, body, done) => done(null, body),
  );

  fastify.post("/webhooks/stripe", async (request, reply) => {
    const signature = request.headers["stripe-signature"];
    if (!signature || typeof signature !== "string") {
      return reply.code(400).send({ error: "missing_signature" });
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(
        request.body as Buffer,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET ?? "",
      );
    } catch {
      return reply.code(400).send({ error: "invalid_signature" });
    }

    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event);
    } else if (event.type === "charge.dispute.created") {
      await handleDisputeCreated(event);
    }

    return reply.send({ received: true });
  });
}

async function handleCheckoutCompleted(event: Stripe.CheckoutSessionCompletedEvent) {
  const session = event.data.object;
  const userId = session.client_reference_id;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  if (!userId || !paymentIntentId) return;

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.stripeWebhookEvents).values({ eventId: event.id });
      await tx
        .update(schema.user)
        .set({ entitlementStatus: "paid", paidAt: new Date() })
        .where(eq(schema.user.id, userId));
      await tx.insert(schema.stripePayments).values({ paymentIntentId, userId });
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // event.id already processed — no-op, respond success without reprocessing.
  }
}

async function handleDisputeCreated(event: Stripe.ChargeDisputeCreatedEvent) {
  const dispute = event.data.object;
  const paymentIntentId =
    typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
  if (!paymentIntentId) return;

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.stripeWebhookEvents).values({ eventId: event.id });
      const [payment] = await tx
        .select()
        .from(schema.stripePayments)
        .where(eq(schema.stripePayments.paymentIntentId, paymentIntentId));
      if (payment) {
        await tx
          .update(schema.user)
          .set({ entitlementStatus: "unpaid" })
          .where(eq(schema.user.id, payment.userId));
      }
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
}
