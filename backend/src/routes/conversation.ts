import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { getSessionUser } from "../auth/session.js";
import { checkEntitlement } from "../entitlement/entitlement.js";
import { db, schema } from "../db/client.js";
import {
  getCrisisResource,
  getTopicSeedChips,
  PERSONA_COMBINATIONS,
  TIME_EXPECTATION_COPY,
  type PersonaCombination,
} from "../config.js";
import { selectPersona } from "../conversation/persona.js";
import { checkCrisisLanguage } from "../conversation/crisis-safety.js";
import { generateConversationalReply, type TranscriptTurnInput } from "../conversation/reply.js";
import { REDIRECT_TURN_CONTENT } from "../conversation/redirect.js";
import type { AnchorSteering } from "../conversation/system-prompt.js";
import { mineSession } from "../mining/mine-session.js";

interface StartSessionBody {
  anchorId?: string;
  persona?: PersonaCombination;
  mode?: "voice" | "text";
}

interface CreateAnchorBody {
  label?: string;
  targetRole?: string;
  targetIndustry?: string;
  jobDescriptionText?: string;
  company?: string;
}

interface SubmitTurnBody {
  content?: string;
}

function isValidPersona(persona: PersonaCombination): boolean {
  return PERSONA_COMBINATIONS.some(
    (candidate) =>
      candidate.ageRange === persona.ageRange &&
      candidate.genderPresentation === persona.genderPresentation,
  );
}

async function loadOwnedSession(sessionId: string, userId: string) {
  const [session] = await db
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.id, sessionId), eq(schema.sessions.userId, userId)));
  return session ?? null;
}

async function loadOwnedAnchor(anchorId: string, userId: string) {
  const [anchor] = await db
    .select()
    .from(schema.anchors)
    .where(and(eq(schema.anchors.id, anchorId), eq(schema.anchors.userId, userId)));
  return anchor ?? null;
}

function anchorSteeringFrom(anchor: { targetRole: string | null; targetIndustry: string | null } | null): AnchorSteering | undefined {
  if (!anchor) return undefined;
  return { targetRole: anchor.targetRole, targetIndustry: anchor.targetIndustry };
}

async function loadHistory(sessionId: string): Promise<TranscriptTurnInput[]> {
  const turns = await db
    .select()
    .from(schema.transcriptTurns)
    .where(eq(schema.transcriptTurns.sessionId, sessionId))
    .orderBy(asc(schema.transcriptTurns.ts));
  return turns.map((turn) => ({
    speaker: turn.speaker as "user" | "assistant",
    content: turn.content,
  }));
}

export async function conversationRoutes(fastify: FastifyInstance) {
  // Resume support — added after M2.1's tab bar made it trivial to navigate
  // away mid-conversation and lose all client-side state (nothing was ever
  // persisted beyond the DB rows themselves). Read-only: never creates or
  // mutates a session, just tells the client whether one is already open so
  // it can skip the setup screen. Full history/resume UI is M6's job later;
  // this only prevents the silent data loss.
  fastify.get("/sessions/current", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    const [existing] = await db
      .select()
      .from(schema.sessions)
      .where(and(eq(schema.sessions.userId, user.id), ne(schema.sessions.status, "complete")))
      .orderBy(desc(schema.sessions.createdAt))
      .limit(1);

    if (!existing) return reply.send({ session: null });

    const anchor = existing.anchorId ? await loadOwnedAnchor(existing.anchorId, user.id) : null;
    const history = await loadHistory(existing.id);

    return reply.send({
      session: {
        sessionId: existing.id,
        status: existing.status,
        persona: {
          ageRange: existing.personaAgeRange,
          genderPresentation: existing.personaGenderPresentation,
        },
        anchorBadge: anchor
          ? [anchor.targetRole, anchor.targetIndustry].filter(Boolean).join(", ") || anchor.label
          : null,
        // Chips only make sense before the conversation actually starts —
        // same "disappear once the conversation starts" rule as a fresh
        // session, just evaluated from history length instead of client state.
        chips: history.length === 0 ? getTopicSeedChips(anchorSteeringFrom(anchor)) : [],
        timeExpectation: TIME_EXPECTATION_COPY,
        turns: history,
        crisisFlagged: existing.crisisFlagged,
        crisisResource: existing.crisisFlagged ? getCrisisResource(user.country) : undefined,
      },
    });
  });

  fastify.post<{ Body: StartSessionBody }>("/sessions/start", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    const entitlement = await checkEntitlement(user.id);
    if (!entitlement.allowed) {
      return reply.code(402).send({ error: entitlement.reason, message: entitlement.message });
    }

    const { anchorId, persona: requestedPersona, mode: requestedMode } = request.body ?? {};
    // Defaults to "text" for callers that don't send it (e.g. existing
    // callers predating this change) — typed input is the baseline path
    // everywhere else in this codebase; the web client (M3) always sends an
    // explicit mode. See m3-voice-capture/design.md's Decisions.
    const mode = requestedMode === "voice" ? "voice" : "text";

    let anchor: { targetRole: string | null; targetIndustry: string | null } | null = null;
    if (anchorId) {
      anchor = await loadOwnedAnchor(anchorId, user.id);
      if (!anchor) return reply.code(404).send({ error: "anchor_not_found" });
    }

    if (requestedPersona && !isValidPersona(requestedPersona)) {
      return reply.code(400).send({ error: "invalid_persona" });
    }

    const sessionId = crypto.randomUUID();
    const persona = selectPersona(sessionId, requestedPersona);

    await db.insert(schema.sessions).values({
      id: sessionId,
      userId: user.id,
      anchorId: anchorId ?? null,
      personaAgeRange: persona.ageRange,
      personaGenderPresentation: persona.genderPresentation,
      mode,
    });

    return reply.send({
      sessionId,
      status: "start",
      chips: getTopicSeedChips(anchorSteeringFrom(anchor)),
      timeExpectation: TIME_EXPECTATION_COPY,
      persona,
    });
  });

  fastify.post<{ Body: CreateAnchorBody }>("/anchors", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    const { label, targetRole, targetIndustry, jobDescriptionText, company } = request.body ?? {};
    if (!label) return reply.code(400).send({ error: "label is required" });

    const [anchor] = await db
      .insert(schema.anchors)
      .values({
        userId: user.id,
        label,
        targetRole: targetRole ?? null,
        targetIndustry: targetIndustry ?? null,
        jobDescriptionText: jobDescriptionText ?? null,
        company: company ?? null,
      })
      .returning();

    return reply.send(anchor);
  });

  fastify.post<{ Params: { id: string }; Body: SubmitTurnBody }>(
    "/sessions/:id/turns",
    async (request, reply) => {
      const user = await getSessionUser(request);
      if (!user) return reply.code(401).send({ error: "unauthenticated" });

      const session = await loadOwnedSession(request.params.id, user.id);
      if (!session) return reply.code(404).send({ error: "session_not_found" });
      if (session.status === "complete") {
        return reply.code(409).send({ error: "session_complete" });
      }

      const { content } = request.body ?? {};
      if (!content) return reply.code(400).send({ error: "content is required" });

      // Crisis check runs unconditionally on every user turn — no code path
      // here (or in the redirect route) can skip or gate this. See
      // design.md's Decisions and tasks.md 4.5.
      const crisisDetectedNow = await checkCrisisLanguage(content);

      await db.insert(schema.transcriptTurns).values({
        sessionId: session.id,
        speaker: "user",
        content,
      });

      if (session.status === "start") {
        await db
          .update(schema.sessions)
          .set({ status: "in-progress" })
          .where(eq(schema.sessions.id, session.id));
      }

      const crisisFlagged = session.crisisFlagged || crisisDetectedNow;
      if (crisisDetectedNow && !session.crisisFlagged) {
        await db
          .update(schema.sessions)
          .set({ crisisFlagged: true })
          .where(eq(schema.sessions.id, session.id));
      }

      const anchor = session.anchorId ? await loadOwnedAnchor(session.anchorId, user.id) : null;
      const history = await loadHistory(session.id);

      const generated = await generateConversationalReply({
        persona: {
          ageRange: session.personaAgeRange,
          genderPresentation: session.personaGenderPresentation,
        },
        anchor: anchorSteeringFrom(anchor),
        history,
      });

      await db.insert(schema.transcriptTurns).values({
        sessionId: session.id,
        speaker: "assistant",
        content: generated.text,
      });

      return reply.send({
        reply: generated.text,
        crisisFlagged,
        crisisResource: crisisFlagged ? getCrisisResource(user.country) : undefined,
      });
    },
  );

  fastify.post<{ Params: { id: string } }>("/sessions/:id/redirect", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    const session = await loadOwnedSession(request.params.id, user.id);
    if (!session) return reply.code(404).send({ error: "session_not_found" });
    if (session.status === "complete") {
      return reply.code(409).send({ error: "session_complete" });
    }

    // Deliberately does not call checkCrisisLanguage or touch crisisFlagged —
    // the redirect control has no code path that can suppress an
    // already-triggered safety card (tasks.md 4.5). crisisFlagged below is a
    // plain read-through of existing session state.
    await db.insert(schema.transcriptTurns).values({
      sessionId: session.id,
      speaker: "user",
      content: REDIRECT_TURN_CONTENT,
    });

    if (session.status === "start") {
      await db
        .update(schema.sessions)
        .set({ status: "in-progress" })
        .where(eq(schema.sessions.id, session.id));
    }

    const anchor = session.anchorId ? await loadOwnedAnchor(session.anchorId, user.id) : null;
    const history = await loadHistory(session.id);

    const generated = await generateConversationalReply({
      persona: {
        ageRange: session.personaAgeRange,
        genderPresentation: session.personaGenderPresentation,
      },
      anchor: anchorSteeringFrom(anchor),
      history,
    });

    await db.insert(schema.transcriptTurns).values({
      sessionId: session.id,
      speaker: "assistant",
      content: generated.text,
    });

    return reply.send({
      reply: generated.text,
      crisisFlagged: session.crisisFlagged,
      crisisResource: session.crisisFlagged ? getCrisisResource(user.country) : undefined,
    });
  });

  fastify.post<{ Params: { id: string } }>("/sessions/:id/end", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    const session = await loadOwnedSession(request.params.id, user.id);
    if (!session) return reply.code(404).send({ error: "session_not_found" });

    await db
      .update(schema.sessions)
      .set({ status: "complete", completedAt: new Date() })
      .where(eq(schema.sessions.id, session.id));

    // Fire-and-forget — never awaited, never lets a mining failure affect
    // this response. See mine-session.ts and design.md's Decisions.
    void mineSession(session.id).catch((error) => {
      console.error(`[mining] unhandled mineSession rejection for session ${session.id}`, error);
    });

    return reply.send({ status: "complete" });
  });
}
