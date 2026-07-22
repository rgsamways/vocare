import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { getSessionUser } from "../auth/session.js";

export async function checkoutRoutes(fastify: FastifyInstance) {
  fastify.post("/billing/checkout-session", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: user.id,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.WEB_URL}/account?checkout=success`,
      cancel_url: `${process.env.WEB_URL}/paywall?checkout=cancelled`,
    });

    return reply.send({ url: session.url });
  });
}
