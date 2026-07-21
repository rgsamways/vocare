import Fastify from "fastify";
import { APP_NAME } from "@vocare/shared";

export function buildApp() {
  const fastify = Fastify({ logger: true });

  fastify.get("/health", async () => {
    return { status: "ok", app: APP_NAME };
  });

  return fastify;
}
