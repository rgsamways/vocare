import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const TEST_USER_ID = "mine-session-test-user";
const TEST_EMAIL = "mine-session-test@example.com";

const extractSessionSignalsMock = vi.fn();
vi.mock("./extract.js", () => ({
  extractSessionSignals: extractSessionSignalsMock,
}));

// Wraps the real implementation so most tests exercise real note-generation
// logic, while the failure-path test below can override it for one call.
vi.mock("../feedback/notes.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../feedback/notes.js")>();
  return { ...actual, buildFeedbackReport: vi.fn(actual.buildFeedbackReport) };
});

const { mineSession } = await import("./mine-session.js");
const { db, schema } = await import("../db/client.js");
const { buildFeedbackReport } = (await import("../feedback/notes.js")) as unknown as {
  buildFeedbackReport: ReturnType<typeof vi.fn>;
};

const BASE_RESULT = {
  ownershipLanguagePresent: true,
  tradeoffReasoningPresent: true,
  techDomainMentions: ["Postgres"],
  clarity: "clear" as const,
  sentiment: "positive" as const,
  growthSignals: [],
  outcomeMentioned: true,
  quantifiedImpactExamples: ["cut deploy time by 40%"],
  audienceKeywordMatches: undefined,
  topicRelevanceScore: 90,
};

async function cleanup() {
  const ownedSessions = await db
    .select({ id: schema.sessions.id })
    .from(schema.sessions)
    .where(eq(schema.sessions.userId, TEST_USER_ID));
  const sessionIds = ownedSessions.map((s) => s.id);
  for (const sessionId of sessionIds) {
    await db.delete(schema.feedbackReports).where(eq(schema.feedbackReports.sessionId, sessionId));
    await db.delete(schema.sessionMiningResults).where(eq(schema.sessionMiningResults.sessionId, sessionId));
  }
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, TEST_USER_ID));
  await db.delete(schema.user).where(eq(schema.user.id, TEST_USER_ID));
}

async function createCompletedSession(): Promise<string> {
  await db.insert(schema.user).values({
    id: TEST_USER_ID,
    name: "",
    email: TEST_EMAIL,
    emailVerified: true,
    entitlementStatus: "paid",
    dateOfBirth: new Date("1990-01-01"),
    country: "Canada",
  });
  const [session] = await db
    .insert(schema.sessions)
    .values({
      userId: TEST_USER_ID,
      status: "complete",
      completedAt: new Date(),
      personaAgeRange: "20s-30s",
      personaGenderPresentation: "neutral",
      mode: "text",
    })
    .returning();
  return session.id;
}

describe("mineSession", () => {
  beforeEach(async () => {
    await cleanup();
    extractSessionSignalsMock.mockReset();
    extractSessionSignalsMock.mockResolvedValue(BASE_RESULT);
    buildFeedbackReport.mockClear();
  });

  afterEach(cleanup);

  it("writes both a session_mining_results row and a feedback_reports row on success", async () => {
    const sessionId = await createCompletedSession();

    await mineSession(sessionId);

    const [miningRow] = await db
      .select()
      .from(schema.sessionMiningResults)
      .where(eq(schema.sessionMiningResults.sessionId, sessionId));
    expect(miningRow).toBeDefined();

    const [reportRow] = await db
      .select()
      .from(schema.feedbackReports)
      .where(eq(schema.feedbackReports.sessionId, sessionId));
    expect(reportRow).toBeDefined();
    expect(reportRow.coachingNotes.length).toBeGreaterThan(0);
    expect(reportRow.coachingNotes.some((n) => n.quote === "cut deploy time by 40%")).toBe(true);
    expect(JSON.stringify(reportRow.coachingNotes)).not.toContain("90");
  });

  it("does not roll back the mining insert if feedback generation fails", async () => {
    const sessionId = await createCompletedSession();

    buildFeedbackReport.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    await mineSession(sessionId);

    const [miningRow] = await db
      .select()
      .from(schema.sessionMiningResults)
      .where(eq(schema.sessionMiningResults.sessionId, sessionId));
    expect(miningRow).toBeDefined();

    const [reportRow] = await db
      .select()
      .from(schema.feedbackReports)
      .where(eq(schema.feedbackReports.sessionId, sessionId));
    expect(reportRow).toBeUndefined();
  });
});
