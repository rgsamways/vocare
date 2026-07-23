import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";

const TEST_USER_ID = "progress-route-test-user";
const OTHER_USER_ID = "progress-route-test-other-user";
const TEST_EMAIL = "progress-route-test@example.com";
const OTHER_EMAIL = "progress-route-test-other@example.com";
const TEST_USER = { id: TEST_USER_ID, country: "Canada" };

let sessionUser: typeof TEST_USER | null = TEST_USER;
vi.mock("../auth/session.js", () => ({
  getSessionUser: async () => sessionUser,
}));

const { buildApp } = await import("../app.js");
const { db, schema } = await import("../db/client.js");

async function cleanup() {
  for (const userId of [TEST_USER_ID, OTHER_USER_ID]) {
    const ownedSessions = await db
      .select({ id: schema.sessions.id })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userId));
    const sessionIds = ownedSessions.map((s) => s.id);
    if (sessionIds.length > 0) {
      await db.delete(schema.feedbackReports).where(inArray(schema.feedbackReports.sessionId, sessionIds));
      await db.delete(schema.sessionMiningResults).where(inArray(schema.sessionMiningResults.sessionId, sessionIds));
      await db.delete(schema.transcriptTurns).where(inArray(schema.transcriptTurns.sessionId, sessionIds));
    }
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
    await db.delete(schema.anchors).where(eq(schema.anchors.userId, userId));
    await db.delete(schema.user).where(eq(schema.user.id, userId));
  }
}

async function createUser(id: string, email: string) {
  await db.insert(schema.user).values({
    id,
    name: "",
    email,
    emailVerified: true,
    entitlementStatus: "paid",
    dateOfBirth: new Date("1990-01-01"),
    country: "Canada",
  });
}

async function createSession(
  userId: string,
  opts: {
    status?: "in-progress" | "complete";
    completedAt?: Date;
    createdAt?: Date;
    anchorId?: string | null;
  } = {},
) {
  const status = opts.status ?? "complete";
  const [session] = await db
    .insert(schema.sessions)
    .values({
      userId,
      status,
      createdAt: opts.createdAt,
      completedAt: status === "complete" ? opts.completedAt ?? opts.createdAt ?? new Date() : null,
      anchorId: opts.anchorId ?? null,
      personaAgeRange: "20s-30s",
      personaGenderPresentation: "neutral",
      mode: "text",
    })
    .returning();
  return session.id;
}

async function createMiningResult(
  sessionId: string,
  overrides: Partial<{ tradeoffReasoningPresent: boolean; audienceKeywordMatches: string[] | null }> = {},
) {
  await db.insert(schema.sessionMiningResults).values({
    sessionId,
    ownershipLanguagePresent: true,
    tradeoffReasoningPresent: overrides.tradeoffReasoningPresent ?? false,
    techDomainMentions: [],
    clarity: "clear",
    sentiment: "neutral",
    growthSignals: [],
    outcomeMentioned: false,
    quantifiedImpactExamples: [],
    audienceKeywordMatches: overrides.audienceKeywordMatches ?? null,
    topicRelevanceScore: 5,
  });
}

async function createAnchor(userId: string, label = "Backend engineer") {
  const [anchor] = await db
    .insert(schema.anchors)
    .values({ userId, label, targetRole: "Backend engineer" })
    .returning();
  return anchor.id;
}

describe("progress routes", () => {
  beforeEach(async () => {
    await cleanup();
    sessionUser = TEST_USER;
    await createUser(TEST_USER_ID, TEST_EMAIL);
    await createUser(OTHER_USER_ID, OTHER_EMAIL);
  });

  afterEach(cleanup);

  describe("GET /sessions", () => {
    it("returns 401 when unauthenticated", async () => {
      sessionUser = null;
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/sessions" });
      expect(res.statusCode).toBe(401);
    });

    it("excludes incomplete sessions", async () => {
      await createSession(TEST_USER_ID, { status: "in-progress" });
      const completedId = await createSession(TEST_USER_ID, { status: "complete" });

      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/sessions" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].sessionId).toBe(completedId);
    });

    it("includes a word-boundary-truncated topicPreview from the first user turn", async () => {
      const sessionId = await createSession(TEST_USER_ID, { status: "complete" });
      const longFirstTurn =
        "Migrating our billing service off a monolith took about three months and touched every downstream team we had.";
      await db.insert(schema.transcriptTurns).values([
        { sessionId, speaker: "assistant", content: "Tell me about a recent project." },
        { sessionId, speaker: "user", content: longFirstTurn },
        { sessionId, speaker: "user", content: "A second user turn that should be ignored." },
      ]);

      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/sessions" });
      const preview: string = res.json()[0].topicPreview;
      expect(preview.length).toBeLessThanOrEqual(91); // 90 + ellipsis
      expect(preview.endsWith("…")).toBe(true);
      const withoutEllipsis = preview.slice(0, -1);
      expect(longFirstTurn.startsWith(withoutEllipsis)).toBe(true); // cut, not paraphrased
      expect(withoutEllipsis.endsWith(" ")).toBe(false); // cut at a word boundary, not mid-word
    });

    it("returns topicPreview null, not an error, for a completed session with no user turns", async () => {
      await createSession(TEST_USER_ID, { status: "complete" });

      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/sessions" });
      expect(res.statusCode).toBe(200);
      expect(res.json()[0].topicPreview).toBeNull();
    });
  });

  describe("GET /sessions/:id", () => {
    it("returns transcript and feedback report together for an owned completed session", async () => {
      const sessionId = await createSession(TEST_USER_ID, { status: "complete" });
      await db.insert(schema.transcriptTurns).values([
        { sessionId, speaker: "assistant", content: "Hi there" },
        { sessionId, speaker: "user", content: "Hello" },
      ]);
      await db.insert(schema.feedbackReports).values({
        sessionId,
        coachingNotes: [{ kind: "closing", note: "Nice work." }],
      });

      const app = buildApp();
      const res = await app.inject({ method: "GET", url: `/sessions/${sessionId}` });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.turns).toHaveLength(2);
      expect(body.feedbackReport.coachingNotes[0].note).toBe("Nice work.");
    });

    it("denies a non-owner as if the session did not exist", async () => {
      const sessionId = await createSession(OTHER_USER_ID, { status: "complete" });
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: `/sessions/${sessionId}` });
      expect(res.statusCode).toBe(404);
    });

    it("denies access to an incomplete session as if it did not exist", async () => {
      const sessionId = await createSession(TEST_USER_ID, { status: "in-progress" });
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: `/sessions/${sessionId}` });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("GET /progress/trends", () => {
    it("reports a newly-present tradeoff-reasoning trend across 4 sessions", async () => {
      const base = new Date("2026-07-01T00:00:00Z").getTime();
      for (const [i, present] of [false, false, false, true].entries()) {
        const sid = await createSession(TEST_USER_ID, { createdAt: new Date(base + i * 86_400_000) });
        await createMiningResult(sid, { tradeoffReasoningPresent: present });
      }

      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/progress/trends" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.tradeoffReasoningTrend.direction).toBe("improved");
    });

    it("reports a newly-absent tradeoff-reasoning trend in the same register", async () => {
      const base = new Date("2026-07-01T00:00:00Z").getTime();
      for (const [i, present] of [true, false, false, false].entries()) {
        const sid = await createSession(TEST_USER_ID, { createdAt: new Date(base + i * 86_400_000) });
        await createMiningResult(sid, { tradeoffReasoningPresent: present });
      }

      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/progress/trends" });
      const body = res.json();
      expect(body.tradeoffReasoningTrend.direction).toBe("declined");
    });

    it("omits the tradeoff-reasoning trend with fewer than 4 completed sessions", async () => {
      const base = new Date("2026-07-01T00:00:00Z").getTime();
      for (const [i, present] of [false, true].entries()) {
        const sid = await createSession(TEST_USER_ID, { createdAt: new Date(base + i * 86_400_000) });
        await createMiningResult(sid, { tradeoffReasoningPresent: present });
      }

      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/progress/trends" });
      const body = res.json();
      expect(body.tradeoffReasoningTrend).toBeNull();
    });

    it("scopes the audience-alignment trend per anchor when the user holds more than one", async () => {
      const anchorA = await createAnchor(TEST_USER_ID, "Anchor A");
      const anchorB = await createAnchor(TEST_USER_ID, "Anchor B");
      const base = new Date("2026-07-01T00:00:00Z").getTime();

      const matchCounts = [["x"], ["x"], ["x"], ["x", "y", "z"]];
      for (const [i, matches] of matchCounts.entries()) {
        const sid = await createSession(TEST_USER_ID, {
          anchorId: anchorA,
          createdAt: new Date(base + i * 86_400_000),
        });
        await createMiningResult(sid, { audienceKeywordMatches: matches });
      }
      // Anchor B has no sessions at all — should produce no trend entry for it.
      void anchorB;

      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/progress/trends" });
      const body = res.json();
      expect(body.audienceAlignmentTrends).toHaveLength(1);
      expect(body.audienceAlignmentTrends[0].anchorId).toBe(anchorA);
      expect(body.audienceAlignmentTrends[0].direction).toBe("improved");
    });

    it("produces no audience-alignment trend when sessions have no linked anchor", async () => {
      const base = new Date("2026-07-01T00:00:00Z").getTime();
      for (let i = 0; i < 4; i++) {
        const sid = await createSession(TEST_USER_ID, { createdAt: new Date(base + i * 86_400_000) });
        await createMiningResult(sid, { audienceKeywordMatches: null });
      }

      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/progress/trends" });
      const body = res.json();
      expect(body.audienceAlignmentTrends).toEqual([]);
    });

    it("never includes a filler-word key in the response", async () => {
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/progress/trends" });
      const body = res.json();
      expect(JSON.stringify(body).toLowerCase()).not.toContain("filler");
    });
  });
});
