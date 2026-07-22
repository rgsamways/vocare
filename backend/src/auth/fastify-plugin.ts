import type { FastifyInstance, FastifyReply } from "fastify";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";

// @fastify/cors sets headers via reply.header(), flushed by Fastify's normal
// send pipeline — reply.hijack() below bypasses that pipeline entirely, so
// CORS headers have to be written straight onto the raw response instead.
function setCorsHeaders(reply: FastifyReply) {
  const origin = process.env.WEB_URL;
  if (!origin) return;
  reply.raw.setHeader("Access-Control-Allow-Origin", origin);
  reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
  reply.raw.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  reply.raw.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/**
 * Better Auth's Node handler reads and parses the raw request body itself.
 * Scoped here (not global) so this plugin's content-type parser — a no-op
 * that leaves the stream untouched — never affects any other route's JSON
 * parsing, same principle as the Stripe webhook's raw-body plugin.
 */
export async function authPlugin(fastify: FastifyInstance) {
  fastify.addContentTypeParser(
    ["application/json", "text/plain", "application/x-www-form-urlencoded"],
    (_request, _payload, done) => {
      done(null, undefined);
    },
  );
  fastify.addContentTypeParser("*", (_request, _payload, done) => {
    done(null, undefined);
  });

  fastify.all("/api/auth/*", async (request, reply) => {
    setCorsHeaders(reply);
    if (request.method === "OPTIONS") {
      reply.code(204).send();
      return;
    }
    reply.hijack();
    await toNodeHandler(auth)(request.raw, reply.raw);
  });
}
