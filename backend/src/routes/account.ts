import type { FastifyInstance } from "fastify";
import { getSessionUser } from "../auth/session.js";
import { getEntitlementSnapshot } from "../entitlement/entitlement.js";
import { deleteUserCascade } from "../account/delete-user-cascade.js";

export async function accountRoutes(fastify: FastifyInstance) {
  fastify.get("/account/me", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    const snapshot = await getEntitlementSnapshot(user.id);
    return reply.send(snapshot);
  });

  fastify.delete("/account", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    await deleteUserCascade(user.id);
    reply.header("set-cookie", "better-auth.session_token=; Max-Age=0; Path=/");
    return reply.send({ ok: true });
  });
}
