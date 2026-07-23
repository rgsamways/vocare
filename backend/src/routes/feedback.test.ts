import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";

const TEST_USER_ID = "feedback-route-test-user";
const OTHER_USER_ID = "feedback-route-test-other-user";
const TEST_EMAIL = "feedback-route-test@example.com";
const OTHER_EMAIL = "feedback-route-test-other@example.com";

let sessionUser: { id: string; country: string } | null = { id: TEST_USER_ID, country: "Canada" };
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
    }
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
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
  status: "in-progress" | "complete",
  completedAt?: Date,
) {
  const [session] = await db
    .insert(schema.sessions)
    .values({
      userId,
      status,
      completedAt: status === "complete" ? completedAt ?? new Date() : null,
      personaAgeRange: "20s-30s",
      personaGenderPresentation: "neutral",
      mode: "text",
    })
    .returning();
  return session.id;
}

describe("feedback routes", () => {
  beforeEach(async () => {
    await cleanup();
    sessionUser = { id: TEST_USER_ID, country: "Canada" };
    await createUser(TEST_USER_ID, TEST_EMAIL);
    await createUser(OTHER_USER_ID, OTHER_EMAIL);
  });

  afterEach(cleanup);

  describe("GET /sessions/:id/feedback", () => {
    it("returns 401 when unauthenticated", async () => {
      sessionUser = null;
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/sessions/some-id/feedback" });
      expect(res.statusCode).toBe(401);
    });

    it("returns 404 for a nonexistent session", async () => {
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/sessions/00000000-0000-0000-0000-000000000000/feedback" });
      expect(res.statusCode).toBe(404);
    });

    it("returns 404 for a session owned by another user", async () => {
      const sessionId = await createSession(OTHER_USER_ID, "complete");
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: `/sessions/${sessionId}/feedback` });
      expect(res.statusCode).toBe(404);
    });

    it("returns pending for a complete session with no report yet", async () => {
      const sessionId = await createSession(TEST_USER_ID, "complete");
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: `/sessions/${sessionId}/feedback` });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: "pending" });
    });

    it("returns the ready report once one exists", async () => {
      const sessionId = await createSession(TEST_USER_ID, "complete");
      await db.insert(schema.feedbackReports).values({
        sessionId,
        coachingNotes: [{ kind: "closing", note: "Thanks for practicing." }],
      });

      const app = buildApp();
      const res = await app.inject({ method: "GET", url: `/sessions/${sessionId}/feedback` });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe("ready");
      expect(body.report.coachingNotes[0].note).toBe("Thanks for practicing.");
    });
  });

  describe("GET /feedback/latest", () => {
    it("returns none when the user has no completed sessions", async () => {
      await createSession(TEST_USER_ID, "in-progress");
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/feedback/latest" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: "none" });
    });

    it("returns the most recently completed session's report", async () => {
      await createSession(TEST_USER_ID, "complete", new Date("2026-07-01T00:00:00Z"));
      const latestSessionId = await createSession(TEST_USER_ID, "complete", new Date("2026-07-20T00:00:00Z"));
      await db.insert(schema.feedbackReports).values({
        sessionId: latestSessionId,
        coachingNotes: [{ kind: "closing", note: "latest report" }],
      });

      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/feedback/latest" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe("ready");
      expect(body.report.sessionId).toBe(latestSessionId);
    });
  });
});
