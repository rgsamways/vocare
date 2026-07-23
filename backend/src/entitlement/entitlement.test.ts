import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { buildApp } from "../app.js";
import { db, schema } from "../db/client.js";
import { checkEntitlement, VELOCITY_CAP_MESSAGE } from "./entitlement.js";
import { FAIR_USE_CAP, FREE_SESSION_LIMIT, OFF_TOPIC_SESSION_LIMIT, OFF_TOPIC_THRESHOLD } from "../config.js";

const TEST_USER_ID = "entitlement-test-user";
const TEST_EMAIL = "entitlement-test@example.com";

async function seedUser(entitlementStatus: "paid" | "unpaid" = "unpaid") {
  await db.insert(schema.user).values({
    id: TEST_USER_ID,
    name: "",
    email: TEST_EMAIL,
    emailVerified: true,
    entitlementStatus,
    dateOfBirth: new Date("1990-01-01"),
    country: "Canada",
  });
}

async function seedSession(opts: {
  status: "start" | "in-progress" | "complete";
  crisisFlagged?: boolean;
  createdAt?: Date;
}) {
  await db.insert(schema.sessions).values({
    userId: TEST_USER_ID,
    status: opts.status,
    crisisFlagged: opts.crisisFlagged ?? false,
    createdAt: opts.createdAt ?? new Date(),
    personaAgeRange: "20s-30s",
    personaGenderPresentation: "neutral",
    mode: "text",
  });
}

async function seedMinedSession(opts: { topicRelevanceScore: number; crisisFlagged?: boolean }) {
  const [session] = await db
    .insert(schema.sessions)
    .values({
      userId: TEST_USER_ID,
      status: "complete",
      crisisFlagged: opts.crisisFlagged ?? false,
      personaAgeRange: "20s-30s",
      personaGenderPresentation: "neutral",
      mode: "text",
    })
    .returning();
  await db.insert(schema.sessionMiningResults).values({
    sessionId: session.id,
    ownershipLanguagePresent: false,
    tradeoffReasoningPresent: false,
    techDomainMentions: [],
    clarity: "unclear",
    sentiment: "neutral",
    growthSignals: [],
    outcomeMentioned: false,
    quantifiedImpactExamples: [],
    topicRelevanceScore: opts.topicRelevanceScore,
  });
  return session;
}

async function cleanup() {
  const ownedSessions = await db
    .select({ id: schema.sessions.id })
    .from(schema.sessions)
    .where(eq(schema.sessions.userId, TEST_USER_ID));
  const sessionIds = ownedSessions.map((s) => s.id);
  if (sessionIds.length > 0) {
    await db.delete(schema.sessionMiningResults).where(inArray(schema.sessionMiningResults.sessionId, sessionIds));
  }
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, TEST_USER_ID));
  await db.delete(schema.user).where(eq(schema.user.id, TEST_USER_ID));
}

describe("session entitlement", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("never trusts a client-supplied entitlement value — only server state decides", async () => {
    await seedUser("unpaid");
    for (let i = 0; i < FREE_SESSION_LIMIT; i++) {
      await seedSession({ status: "complete" });
    }

    const app = buildApp();
    // The route accepts no body/header claiming paid status — nothing to spoof.
    const res = await app.inject({
      method: "GET",
      url: "/entitlement/check",
      headers: { "x-claimed-entitlement": "paid" },
    });

    // No session cookie at all → unauthenticated, but the key property under
    // test is that checkEntitlement() itself only reads DB state:
    expect(res.statusCode).toBe(401);
    const direct = await checkEntitlement(TEST_USER_ID);
    expect(direct).toEqual({ allowed: false, reason: "paywall", message: expect.any(String) });
  });

  it("allows a session start below the 3 free-session boundary", async () => {
    await seedUser("unpaid");
    await seedSession({ status: "complete" });
    await seedSession({ status: "complete" });

    const result = await checkEntitlement(TEST_USER_ID);
    expect(result).toEqual({ allowed: true });
  });

  it("blocks a session start exactly at the 3 free-session boundary", async () => {
    await seedUser("unpaid");
    await seedSession({ status: "complete" });
    await seedSession({ status: "complete" });
    await seedSession({ status: "complete" });

    const result = await checkEntitlement(TEST_USER_ID);
    expect(result.allowed).toBe(false);
    expect(result).toMatchObject({ reason: "paywall" });
  });

  it("does not count an abandoned (non-complete) session toward the free limit", async () => {
    await seedUser("unpaid");
    await seedSession({ status: "complete" });
    await seedSession({ status: "complete" });
    await seedSession({ status: "start" }); // abandoned — never finished

    const result = await checkEntitlement(TEST_USER_ID);
    expect(result).toEqual({ allowed: true });
  });

  it("exempts crisis-flagged sessions from the free-session count", async () => {
    await seedUser("unpaid");
    await seedSession({ status: "complete", crisisFlagged: true });
    await seedSession({ status: "complete", crisisFlagged: true });
    await seedSession({ status: "complete", crisisFlagged: true });

    const result = await checkEntitlement(TEST_USER_ID);
    expect(result).toEqual({ allowed: true });
  });

  it("blocks a paid user who exceeds the velocity cap", async () => {
    await seedUser("paid");
    for (let i = 0; i < FAIR_USE_CAP.per24h; i++) {
      await seedSession({ status: "complete" });
    }

    const result = await checkEntitlement(TEST_USER_ID);
    expect(result).toEqual({
      allowed: false,
      reason: "velocity_cap",
      message: VELOCITY_CAP_MESSAGE,
    });
  });

  it("keeps the velocity-cap message vague about reset timing", () => {
    expect(VELOCITY_CAP_MESSAGE.toLowerCase()).not.toContain("tomorrow");
    expect(VELOCITY_CAP_MESSAGE.toLowerCase()).not.toContain("24 hour");
    expect(VELOCITY_CAP_MESSAGE.toLowerCase()).not.toContain("30 day");
  });

  it("exempts crisis-flagged sessions from the velocity cap", async () => {
    await seedUser("unpaid");
    for (let i = 0; i < FAIR_USE_CAP.per24h; i++) {
      await seedSession({ status: "complete", crisisFlagged: true });
    }

    const result = await checkEntitlement(TEST_USER_ID);
    expect(result).toEqual({ allowed: true });
  });

  it("denies a session start once repeated below-threshold topic-relevance sessions cross the off-topic limit", async () => {
    await seedUser("paid");
    for (let i = 0; i < OFF_TOPIC_SESSION_LIMIT; i++) {
      await seedMinedSession({ topicRelevanceScore: OFF_TOPIC_THRESHOLD - 1 });
    }

    const result = await checkEntitlement(TEST_USER_ID);
    expect(result).toEqual({
      allowed: false,
      reason: "velocity_cap",
      message: VELOCITY_CAP_MESSAGE,
    });
  });

  it("leaves ordinary on-topic usage unaffected by the off-topic signal", async () => {
    await seedUser("paid");
    for (let i = 0; i < OFF_TOPIC_SESSION_LIMIT; i++) {
      await seedMinedSession({ topicRelevanceScore: 90 });
    }

    const result = await checkEntitlement(TEST_USER_ID);
    expect(result).toEqual({ allowed: true });
  });

  it("does not count a completed session toward the off-topic signal until it has a mining result", async () => {
    await seedUser("paid");
    for (let i = 0; i < OFF_TOPIC_SESSION_LIMIT; i++) {
      await seedSession({ status: "complete" }); // no mining result yet
    }

    const result = await checkEntitlement(TEST_USER_ID);
    expect(result).toEqual({ allowed: true });
  });

  it("exempts crisis-flagged sessions from the off-topic signal too", async () => {
    await seedUser("paid");
    for (let i = 0; i < OFF_TOPIC_SESSION_LIMIT; i++) {
      await seedMinedSession({ topicRelevanceScore: OFF_TOPIC_THRESHOLD - 1, crisisFlagged: true });
    }

    const result = await checkEntitlement(TEST_USER_ID);
    expect(result).toEqual({ allowed: true });
  });
});
