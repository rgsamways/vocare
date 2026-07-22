import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asc, eq, inArray } from "drizzle-orm";

const TEST_USER_ID = "conversation-test-user";
const TEST_EMAIL = "conversation-test@example.com";
const TEST_USER = { id: TEST_USER_ID, country: "Canada" };

// Auth is mocked (not real Better Auth cookies) so these tests can exercise
// real route/DB/Anthropic-request logic without HTTP session machinery —
// existing route tests in this codebase test business-logic functions
// directly instead; this is the equivalent for routes whose logic lives
// inline in the fastify handler.
let sessionUser: typeof TEST_USER | null = TEST_USER;
vi.mock("../auth/session.js", () => ({
  getSessionUser: async () => sessionUser,
}));

// Mocked, not a real API call — see crisis-safety.test.ts's note on why (no
// ANTHROPIC_API_KEY in CI). Distinguishes the crisis-check call from the
// conversational-reply call by the presence of output_config.format, which
// only the crisis check sets.
let crisisDetectedNext = false;
const createMock = vi.fn(async (params: { output_config?: unknown }) => {
  if (params.output_config) {
    return { content: [{ type: "text", text: JSON.stringify({ crisis_detected: crisisDetectedNext }) }] };
  }
  return {
    content: [{ type: "text", text: "mocked assistant reply" }],
    usage: { cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  };
});
vi.mock("../conversation/anthropic-client.js", () => ({
  anthropic: { messages: { create: createMock } },
}));

const { buildApp } = await import("../app.js");
const { db, schema } = await import("../db/client.js");
const { REDIRECT_TURN_CONTENT } = await import("../conversation/redirect.js");

async function cleanup() {
  const ownedSessions = await db
    .select({ id: schema.sessions.id })
    .from(schema.sessions)
    .where(eq(schema.sessions.userId, TEST_USER_ID));
  const sessionIds = ownedSessions.map((s) => s.id);
  if (sessionIds.length > 0) {
    await db.delete(schema.transcriptTurns).where(inArray(schema.transcriptTurns.sessionId, sessionIds));
  }
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, TEST_USER_ID));
  await db.delete(schema.anchors).where(eq(schema.anchors.userId, TEST_USER_ID));
  await db.delete(schema.user).where(eq(schema.user.id, TEST_USER_ID));
}

describe("conversation routes", () => {
  beforeEach(async () => {
    await cleanup();
    sessionUser = TEST_USER;
    crisisDetectedNext = false;
    createMock.mockClear();
    await db.insert(schema.user).values({
      id: TEST_USER_ID,
      name: "",
      email: TEST_EMAIL,
      emailVerified: true,
      entitlementStatus: "paid",
      dateOfBirth: new Date("1990-01-01"),
      country: "Canada",
    });
  });

  afterEach(cleanup);

  it("starts a session with generic chips and a valid persona when no anchor is linked", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/sessions/start", payload: {} });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("start");
    expect(body.timeExpectation).toBeTruthy();
    expect(body.chips.length).toBeGreaterThan(0);
    expect(body.chips[0].prompt).not.toContain("related to");
  });

  it("returns anchor-aware chips when the session links an anchor with a target role", async () => {
    const app = buildApp();
    const anchorRes = await app.inject({
      method: "POST",
      url: "/anchors",
      payload: { label: "Product roles", targetRole: "product manager" },
    });
    expect(anchorRes.statusCode).toBe(200);
    const anchor = anchorRes.json();

    const startRes = await app.inject({
      method: "POST",
      url: "/sessions/start",
      payload: { anchorId: anchor.id },
    });

    expect(startRes.statusCode).toBe(200);
    const body = startRes.json();
    expect(body.chips.some((chip: { prompt: string }) => chip.prompt.includes("product manager"))).toBe(
      true,
    );
  });

  it("transitions start -> in-progress on the first turn, then -> complete on end", async () => {
    const app = buildApp();
    const startRes = await app.inject({ method: "POST", url: "/sessions/start", payload: {} });
    const { sessionId } = startRes.json();

    await app.inject({
      method: "POST",
      url: `/sessions/${sessionId}/turns`,
      payload: { content: "I made a decision recently." },
    });

    const [afterTurn] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId));
    expect(afterTurn.status).toBe("in-progress");

    const endRes = await app.inject({ method: "POST", url: `/sessions/${sessionId}/end` });
    expect(endRes.statusCode).toBe(200);

    const [afterEnd] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId));
    expect(afterEnd.status).toBe("complete");
    expect(afterEnd.completedAt).not.toBeNull();
  });

  it("steers with target_role/target_industry only — job_description_text and company never reach the model", async () => {
    const app = buildApp();
    const anchorRes = await app.inject({
      method: "POST",
      url: "/anchors",
      payload: {
        label: "Secret anchor",
        targetRole: "data engineer",
        targetIndustry: "logistics",
        jobDescriptionText: "SECRET_JD_MARKER responsibilities include...",
        company: "SECRET_COMPANY_MARKER Inc",
      },
    });
    const anchor = anchorRes.json();

    const startRes = await app.inject({
      method: "POST",
      url: "/sessions/start",
      payload: { anchorId: anchor.id },
    });
    const { sessionId } = startRes.json();

    await app.inject({
      method: "POST",
      url: `/sessions/${sessionId}/turns`,
      payload: { content: "Here's a decision I made." },
    });

    const replyCall = createMock.mock.calls.find((call) => !call[0].output_config);
    expect(replyCall).toBeDefined();
    const systemText = replyCall![0].system[0].text as string;

    expect(systemText).toContain("data engineer");
    expect(systemText).toContain("logistics");
    expect(systemText).not.toContain("SECRET_JD_MARKER");
    expect(systemText).not.toContain("SECRET_COMPANY_MARKER");
  });

  it("persists a redirect turn as its own record without resetting session state", async () => {
    const app = buildApp();
    const startRes = await app.inject({ method: "POST", url: "/sessions/start", payload: {} });
    const { sessionId } = startRes.json();

    await app.inject({
      method: "POST",
      url: `/sessions/${sessionId}/turns`,
      payload: { content: "First real turn." },
    });

    const redirectRes = await app.inject({ method: "POST", url: `/sessions/${sessionId}/redirect` });
    expect(redirectRes.statusCode).toBe(200);

    const turns = await db
      .select()
      .from(schema.transcriptTurns)
      .where(eq(schema.transcriptTurns.sessionId, sessionId))
      .orderBy(asc(schema.transcriptTurns.ts));

    expect(turns.map((t) => t.speaker)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(turns[2].content).toBe(REDIRECT_TURN_CONTENT);

    const [session] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId));
    expect(session.status).toBe("in-progress");
  });

  it("sets crisis_flagged on trigger, and a later redirect never suppresses it", async () => {
    const app = buildApp();
    const startRes = await app.inject({ method: "POST", url: "/sessions/start", payload: {} });
    const { sessionId } = startRes.json();

    crisisDetectedNext = true;
    const turnRes = await app.inject({
      method: "POST",
      url: `/sessions/${sessionId}/turns`,
      payload: { content: "explicit crisis language here" },
    });
    const turnBody = turnRes.json();
    expect(turnBody.crisisFlagged).toBe(true);
    expect(turnBody.crisisResource).toBeTruthy();

    const [flagged] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId));
    expect(flagged.crisisFlagged).toBe(true);

    crisisDetectedNext = false; // the redirect route must not re-run or clear this either way
    const redirectRes = await app.inject({ method: "POST", url: `/sessions/${sessionId}/redirect` });
    const redirectBody = redirectRes.json();
    expect(redirectBody.crisisFlagged).toBe(true);
    expect(redirectBody.crisisResource).toBeTruthy();
  });

  it("does not trigger crisis_flagged on ordinary content", async () => {
    const app = buildApp();
    const startRes = await app.inject({ method: "POST", url: "/sessions/start", payload: {} });
    const { sessionId } = startRes.json();

    const turnRes = await app.inject({
      method: "POST",
      url: `/sessions/${sessionId}/turns`,
      payload: { content: "This job is stressful but I'm managing." },
    });
    const body = turnRes.json();
    expect(body.crisisFlagged).toBe(false);
    expect(body.crisisResource).toBeUndefined();
  });

  it("persists the given mode on session-start, defaulting to text when omitted", async () => {
    const app = buildApp();

    const voiceRes = await app.inject({
      method: "POST",
      url: "/sessions/start",
      payload: { mode: "voice" },
    });
    const { sessionId: voiceSessionId } = voiceRes.json();
    const [voiceSession] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, voiceSessionId));
    expect(voiceSession.mode).toBe("voice");

    const defaultRes = await app.inject({ method: "POST", url: "/sessions/start", payload: {} });
    const { sessionId: defaultSessionId } = defaultRes.json();
    const [defaultSession] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, defaultSessionId));
    expect(defaultSession.mode).toBe("text");
  });

  it("keeps mode unchanged when a typed turn is submitted during a voice-mode session", async () => {
    const app = buildApp();
    const startRes = await app.inject({
      method: "POST",
      url: "/sessions/start",
      payload: { mode: "voice" },
    });
    const { sessionId } = startRes.json();

    const turnRes = await app.inject({
      method: "POST",
      url: `/sessions/${sessionId}/turns`,
      payload: { content: "A typed turn during a voice-mode session." },
    });
    expect(turnRes.statusCode).toBe(200);

    const [session] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId));
    expect(session.mode).toBe("voice");
  });

  it("rejects an unauthenticated session-start", async () => {
    sessionUser = null;
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/sessions/start", payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it("GET /sessions/current returns null when there's no open session", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/sessions/current" });
    expect(res.statusCode).toBe(200);
    expect(res.json().session).toBeNull();
  });

  it("GET /sessions/current resumes an in-progress session with its transcript, not a fresh one", async () => {
    const app = buildApp();
    const startRes = await app.inject({ method: "POST", url: "/sessions/start", payload: {} });
    const { sessionId } = startRes.json();

    await app.inject({
      method: "POST",
      url: `/sessions/${sessionId}/turns`,
      payload: { content: "First real turn." },
    });

    const currentRes = await app.inject({ method: "GET", url: "/sessions/current" });
    expect(currentRes.statusCode).toBe(200);
    const { session } = currentRes.json();
    expect(session.sessionId).toBe(sessionId);
    expect(session.status).toBe("in-progress");
    expect(session.turns.map((t: { speaker: string }) => t.speaker)).toEqual(["user", "assistant"]);
    expect(session.chips).toEqual([]); // already disappeared, per the setup-screen rule
  });

  it("GET /sessions/current still offers chips for a resumed session with no turns yet", async () => {
    const app = buildApp();
    const startRes = await app.inject({ method: "POST", url: "/sessions/start", payload: {} });
    const { sessionId } = startRes.json();

    const currentRes = await app.inject({ method: "GET", url: "/sessions/current" });
    const { session } = currentRes.json();
    expect(session.sessionId).toBe(sessionId);
    expect(session.chips.length).toBeGreaterThan(0);
  });

  it("GET /sessions/current ignores completed sessions", async () => {
    const app = buildApp();
    const startRes = await app.inject({ method: "POST", url: "/sessions/start", payload: {} });
    const { sessionId } = startRes.json();
    await app.inject({ method: "POST", url: `/sessions/${sessionId}/end` });

    const currentRes = await app.inject({ method: "GET", url: "/sessions/current" });
    expect(currentRes.json().session).toBeNull();
  });
});
