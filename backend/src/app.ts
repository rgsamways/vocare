import Fastify from "fastify";
import cors from "@fastify/cors";
import { APP_NAME } from "@vocare/shared";
import { authPlugin } from "./auth/fastify-plugin.js";
import { signupRoutes } from "./routes/signup.js";
import { stripeWebhookPlugin } from "./billing/webhook-plugin.js";
import { checkoutRoutes } from "./billing/checkout.js";
import { entitlementRoutes } from "./routes/entitlement.js";
import { accountRoutes } from "./routes/account.js";
import { conversationRoutes } from "./routes/conversation.js";

export function buildApp() {
  const fastify = Fastify({ logger: true });

  fastify.register(cors, {
    origin: process.env.WEB_URL ?? false,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  fastify.get("/health", async () => {
    return { status: "ok", app: APP_NAME };
  });

  fastify.register(authPlugin);
  fastify.register(signupRoutes);
  fastify.register(stripeWebhookPlugin);
  fastify.register(checkoutRoutes);
  fastify.register(entitlementRoutes);
  fastify.register(accountRoutes);
  fastify.register(conversationRoutes);

  return fastify;
}
