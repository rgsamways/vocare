import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { getSessionUser } from "../auth/session.js";
import { db, schema } from "../db/client.js";

async function loadOwnedSession(sessionId: string, userId: string) {
  const [session] = await db
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.id, sessionId), eq(schema.sessions.userId, userId)));
  return session ?? null;
}

async function loadReportForSession(sessionId: string) {
  const [report] = await db
    .select()
    .from(schema.feedbackReports)
    .where(eq(schema.feedbackReports.sessionId, sessionId));

  if (report) return { status: "ready" as const, report };
  // Mining runs async off /sessions/:id/end — a completed session with no
  // report yet is a real, expected race, not an error. See
  // m5-coaching-feedback/design.md's Decisions.
  return { status: "pending" as const };
}

export async function feedbackRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>("/sessions/:id/feedback", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    const session = await loadOwnedSession(request.params.id, user.id);
    if (!session) return reply.code(404).send({ error: "session_not_found" });

    return reply.send(await loadReportForSession(session.id));
  });

  fastify.get("/feedback/latest", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    const [latest] = await db
      .select()
      .from(schema.sessions)
      .where(and(eq(schema.sessions.userId, user.id), eq(schema.sessions.status, "complete")))
      .orderBy(desc(schema.sessions.completedAt))
      .limit(1);

    if (!latest) return reply.send({ status: "none" });

    return reply.send(await loadReportForSession(latest.id));
  });
}
