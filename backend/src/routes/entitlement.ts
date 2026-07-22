import type { FastifyInstance } from "fastify";
import { getSessionUser } from "../auth/session.js";
import { checkEntitlement } from "../entitlement/entitlement.js";

/**
 * One platform-agnostic route, called identically by web (before starting a
 * session) and by the future Android client (M10) — no purchase UI, no
 * client-trusted flag, just this server check. See design.md / tasks.md 5.5.
 */
export async function entitlementRoutes(fastify: FastifyInstance) {
  fastify.get("/entitlement/check", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    const result = await checkEntitlement(user.id);
    return reply.send(result);
  });
}
