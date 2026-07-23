import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getSessionUser } from "../auth/session.js";
import { db, schema } from "../db/client.js";

// Word-boundary-safe so a preview never cuts mid-word — matches M5's
// "quote the user's real words" posture (backend/src/feedback/notes.ts),
// not a generated title. See m6-progress-over-time/design.md's 2026-07-23
// correction.
const TOPIC_PREVIEW_MAX_LENGTH = 90;

function truncateAtWordBoundary(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const cut = trimmed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  const safe = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${safe}…`;
}

// Fixed at "3 completed sessions back", omitted entirely below that history
// depth — see m6-progress-over-time/design.md's Decisions on why this isn't
// compared against the earliest available session instead.
const TREND_LOOKBACK = 3;

type TrendDirection = "improved" | "declined" | "unchanged";

interface TrendRow {
  anchorId: string | null;
  anchorLabel: string | null;
  tradeoffReasoningPresent: boolean;
  audienceKeywordMatches: string[] | null;
}

function tradeoffReasoningTrend(rows: TrendRow[]) {
  if (rows.length < TREND_LOOKBACK + 1) return null;

  const recent = rows[rows.length - 1];
  const past = rows[rows.length - 1 - TREND_LOOKBACK];

  let direction: TrendDirection;
  let message: string;
  if (recent.tradeoffReasoningPresent === past.tradeoffReasoningPresent) {
    direction = "unchanged";
    message = recent.tradeoffReasoningPresent
      ? `Included tradeoff reasoning in both this session and ${TREND_LOOKBACK} sessions ago.`
      : `Didn't include tradeoff reasoning this session, same as ${TREND_LOOKBACK} sessions ago.`;
  } else if (recent.tradeoffReasoningPresent) {
    direction = "improved";
    message = `Included tradeoff reasoning this session, which you hadn't ${TREND_LOOKBACK} sessions ago.`;
  } else {
    direction = "declined";
    message = `Didn't include tradeoff reasoning this session, which you had ${TREND_LOOKBACK} sessions ago.`;
  }

  return { direction, message };
}

function audienceAlignmentTrends(rows: TrendRow[]) {
  const byAnchor = new Map<string, TrendRow[]>();
  for (const row of rows) {
    if (!row.anchorId) continue;
    const list = byAnchor.get(row.anchorId) ?? [];
    list.push(row);
    byAnchor.set(row.anchorId, list);
  }

  const trends: Array<{ anchorId: string; anchorLabel: string | null; direction: TrendDirection; message: string }> = [];
  for (const [anchorId, anchorRows] of byAnchor) {
    if (anchorRows.length < TREND_LOOKBACK + 1) continue;

    const recent = anchorRows[anchorRows.length - 1];
    const past = anchorRows[anchorRows.length - 1 - TREND_LOOKBACK];
    if (recent.audienceKeywordMatches == null || past.audienceKeywordMatches == null) continue;

    const recentCount = recent.audienceKeywordMatches.length;
    const pastCount = past.audienceKeywordMatches.length;

    let direction: TrendDirection;
    let message: string;
    if (recentCount === pastCount) {
      direction = "unchanged";
      message = `Matched about the same number of audience-relevant keywords this session as ${TREND_LOOKBACK} sessions ago (${recentCount}).`;
    } else if (recentCount > pastCount) {
      direction = "improved";
      message = `Matched more audience-relevant keywords this session than ${TREND_LOOKBACK} sessions ago (${recentCount} vs ${pastCount}).`;
    } else {
      direction = "declined";
      message = `Matched fewer audience-relevant keywords this session than ${TREND_LOOKBACK} sessions ago (${recentCount} vs ${pastCount}).`;
    }

    trends.push({ anchorId, anchorLabel: recent.anchorLabel, direction, message });
  }

  return trends;
}

export async function progressRoutes(fastify: FastifyInstance) {
  fastify.get("/sessions", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    const rows = await db
      .select({
        sessionId: schema.sessions.id,
        createdAt: schema.sessions.createdAt,
        completedAt: schema.sessions.completedAt,
        anchorLabel: schema.anchors.label,
      })
      .from(schema.sessions)
      .leftJoin(schema.anchors, eq(schema.sessions.anchorId, schema.anchors.id))
      .where(and(eq(schema.sessions.userId, user.id), eq(schema.sessions.status, "complete")))
      .orderBy(desc(schema.sessions.createdAt));

    // One query for every session's first user turn, rather than N+1 — low
    // per-user session volume (design.md's on-demand-trends posture applies
    // here too) makes this cheap even unbatched by session.
    const sessionIds = rows.map((row) => row.sessionId);
    const firstUserTurnBySession = new Map<string, string>();
    if (sessionIds.length > 0) {
      const userTurns = await db
        .select({ sessionId: schema.transcriptTurns.sessionId, content: schema.transcriptTurns.content })
        .from(schema.transcriptTurns)
        .where(and(inArray(schema.transcriptTurns.sessionId, sessionIds), eq(schema.transcriptTurns.speaker, "user")))
        .orderBy(asc(schema.transcriptTurns.ts));
      for (const turn of userTurns) {
        if (!firstUserTurnBySession.has(turn.sessionId)) {
          firstUserTurnBySession.set(turn.sessionId, turn.content);
        }
      }
    }

    return reply.send(
      rows.map((row) => {
        const firstUserTurn = firstUserTurnBySession.get(row.sessionId);
        return {
          sessionId: row.sessionId,
          createdAt: row.createdAt,
          completedAt: row.completedAt,
          anchorLabel: row.anchorLabel ?? null,
          topicPreview: firstUserTurn ? truncateAtWordBoundary(firstUserTurn, TOPIC_PREVIEW_MAX_LENGTH) : null,
        };
      }),
    );
  });

  fastify.get<{ Params: { id: string } }>("/sessions/:id", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    const [session] = await db
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.id, request.params.id),
          eq(schema.sessions.userId, user.id),
          eq(schema.sessions.status, "complete"),
        ),
      );
    if (!session) return reply.code(404).send({ error: "session_not_found" });

    const turns = await db
      .select()
      .from(schema.transcriptTurns)
      .where(eq(schema.transcriptTurns.sessionId, session.id))
      .orderBy(asc(schema.transcriptTurns.ts));

    const [report] = await db
      .select()
      .from(schema.feedbackReports)
      .where(eq(schema.feedbackReports.sessionId, session.id));

    const [anchor] = session.anchorId
      ? await db.select().from(schema.anchors).where(eq(schema.anchors.id, session.anchorId))
      : [null];

    return reply.send({
      sessionId: session.id,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
      anchorLabel: anchor?.label ?? null,
      turns,
      feedbackReport: report ?? null,
    });
  });

  fastify.get("/progress/trends", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    const rows = await db
      .select({
        anchorId: schema.sessions.anchorId,
        anchorLabel: schema.anchors.label,
        completedAt: schema.sessions.completedAt,
        tradeoffReasoningPresent: schema.sessionMiningResults.tradeoffReasoningPresent,
        audienceKeywordMatches: schema.sessionMiningResults.audienceKeywordMatches,
      })
      .from(schema.sessions)
      .innerJoin(schema.sessionMiningResults, eq(schema.sessions.id, schema.sessionMiningResults.sessionId))
      .leftJoin(schema.anchors, eq(schema.sessions.anchorId, schema.anchors.id))
      .where(and(eq(schema.sessions.userId, user.id), eq(schema.sessions.status, "complete")))
      .orderBy(asc(schema.sessions.completedAt));

    return reply.send({
      tradeoffReasoningTrend: tradeoffReasoningTrend(rows),
      audienceAlignmentTrends: audienceAlignmentTrends(rows),
    });
  });
}
