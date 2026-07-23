import { asc, eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import type { TranscriptTurnInput } from "../conversation/reply.js";
import { extractSessionSignals } from "./extract.js";

async function loadTranscript(sessionId: string): Promise<TranscriptTurnInput[]> {
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

/**
 * The single seam a later Batch API swap touches without changing
 * `conversation.ts` — see design.md's Decisions. Never throws: a mining
 * failure has no user-facing consequence today (M5, which would surface
 * results, doesn't exist yet) and must never affect session completion.
 */
export async function mineSession(sessionId: string): Promise<void> {
  try {
    const [session] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId));
    if (!session || session.status !== "complete") return;

    const anchor = session.anchorId
      ? ((await db.select().from(schema.anchors).where(eq(schema.anchors.id, session.anchorId)))[0] ?? null)
      : null;

    const transcript = await loadTranscript(sessionId);

    const result = await extractSessionSignals({
      transcript,
      targetRole: anchor?.targetRole,
      jobDescriptionText: anchor?.jobDescriptionText,
    });
    if (!result) {
      console.error(`[mining] no extraction result for session ${sessionId}, skipping write`);
      return;
    }

    await db.insert(schema.sessionMiningResults).values({
      sessionId,
      ownershipLanguagePresent: result.ownershipLanguagePresent,
      tradeoffReasoningPresent: result.tradeoffReasoningPresent,
      techDomainMentions: result.techDomainMentions,
      clarity: result.clarity,
      sentiment: result.sentiment,
      growthSignals: result.growthSignals,
      outcomeMentioned: result.outcomeMentioned,
      quantifiedImpactExamples: result.quantifiedImpactExamples,
      audienceKeywordMatches: result.audienceKeywordMatches ?? null,
      topicRelevanceScore: result.topicRelevanceScore,
    });
  } catch (error) {
    console.error(`[mining] mineSession failed for session ${sessionId}`, error);
  }
}
