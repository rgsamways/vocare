import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { desc, eq, like } from "drizzle-orm";
import { buildApp } from "../app.js";
import { db, schema } from "../db/client.js";
import { MINIMUM_AGE } from "../config.js";

vi.mock("./send-magic-link.js", () => ({
  sendMagicLink: vi.fn().mockResolvedValue(undefined),
}));

const TEST_EMAIL = "auth-test@example.com";

function verificationForEmail(email: string) {
  return like(schema.verification.value, `%"email":"${email}"%`);
}

async function cleanup(email: string) {
  const [user] = await db.select().from(schema.user).where(eq(schema.user.email, email));
  if (user) {
    await db.delete(schema.session).where(eq(schema.session.userId, user.id));
    await db.delete(schema.account).where(eq(schema.account.userId, user.id));
    await db.delete(schema.user).where(eq(schema.user.id, user.id));
  }
  await db.delete(schema.pendingSignups).where(eq(schema.pendingSignups.email, email));
  await db.delete(schema.verification).where(verificationForEmail(email));
}

async function requestMagicLink(app: ReturnType<typeof buildApp>, email: string, dateOfBirth: string) {
  await app.inject({
    method: "POST",
    url: "/auth/pending-signup",
    payload: { email, dateOfBirth, country: "Canada" },
  });
  await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/magic-link",
    payload: { email },
  });
  const [row] = await db
    .select()
    .from(schema.verification)
    .where(verificationForEmail(email))
    .orderBy(desc(schema.verification.createdAt));
  return row.identifier;
}

describe("magic-link auth", () => {
  beforeEach(async () => {
    await cleanup(TEST_EMAIL);
  });

  afterEach(async () => {
    await cleanup(TEST_EMAIL);
  });

  it("blocks sign-up below the configured minimum age and creates no account", async () => {
    const app = buildApp();
    const underageDob = new Date();
    underageDob.setFullYear(underageDob.getFullYear() - (MINIMUM_AGE - 1));

    const res = await app.inject({
      method: "POST",
      url: "/auth/pending-signup",
      payload: {
        email: TEST_EMAIL,
        dateOfBirth: underageDob.toISOString().slice(0, 10),
        country: "Canada",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "below_minimum_age" });

    const pending = await db
      .select()
      .from(schema.pendingSignups)
      .where(eq(schema.pendingSignups.email, TEST_EMAIL));
    expect(pending).toHaveLength(0);
  });

  it("issues a magic link without creating a session until verified", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/pending-signup",
      payload: { email: TEST_EMAIL, dateOfBirth: "1990-01-01", country: "Canada" },
    });
    expect(res.statusCode).toBe(200);

    const linkRes = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/magic-link",
      payload: { email: TEST_EMAIL },
    });
    expect(linkRes.statusCode).toBe(200);

    const verificationRows = await db
      .select()
      .from(schema.verification)
      .where(verificationForEmail(TEST_EMAIL));
    expect(verificationRows).toHaveLength(1);

    const users = await db.select().from(schema.user).where(eq(schema.user.email, TEST_EMAIL));
    expect(users).toHaveLength(0);
  });

  it("verifies a valid magic link, creates the user with dateOfBirth/country/unpaid entitlement, and starts a 30-day sliding session", async () => {
    const app = buildApp();
    const token = await requestMagicLink(app, TEST_EMAIL, "1985-06-15");

    const before = Date.now();
    const verifyRes = await app.inject({
      method: "GET",
      url: `/api/auth/magic-link/verify?token=${token}&callbackURL=%2F`,
    });

    expect(verifyRes.statusCode).toBe(302);
    expect(verifyRes.headers["set-cookie"]).toBeDefined();

    const [user] = await db.select().from(schema.user).where(eq(schema.user.email, TEST_EMAIL));
    expect(user).toBeDefined();
    expect(user.entitlementStatus).toBe("unpaid");
    expect(user.country).toBe("Canada");
    expect(new Date(user.dateOfBirth).toISOString().slice(0, 10)).toBe("1985-06-15");

    const pending = await db
      .select()
      .from(schema.pendingSignups)
      .where(eq(schema.pendingSignups.email, TEST_EMAIL));
    expect(pending).toHaveLength(0);

    const [session] = await db.select().from(schema.session).where(eq(schema.session.userId, user.id));
    expect(session).toBeDefined();
    const expiresInDays = (session.expiresAt.getTime() - before) / (1000 * 60 * 60 * 24);
    expect(expiresInDays).toBeGreaterThan(29.9);
    expect(expiresInDays).toBeLessThan(30.1);
  });

  it("rejects an already-consumed magic link token without issuing a session", async () => {
    const app = buildApp();
    const token = await requestMagicLink(app, TEST_EMAIL, "1985-06-15");

    await app.inject({
      method: "GET",
      url: `/api/auth/magic-link/verify?token=${token}&callbackURL=%2F`,
    });

    const secondAttempt = await app.inject({
      method: "GET",
      url: `/api/auth/magic-link/verify?token=${token}&callbackURL=%2F`,
    });

    expect(secondAttempt.statusCode).toBe(302);
    expect(secondAttempt.headers.location).toContain("error=INVALID_TOKEN");
    expect(secondAttempt.headers["set-cookie"]).toBeUndefined();
  });

  it("does not require the age gate for a returning user's sign-in", async () => {
    const app = buildApp();
    const firstToken = await requestMagicLink(app, TEST_EMAIL, "1985-06-15");
    await app.inject({
      method: "GET",
      url: `/api/auth/magic-link/verify?token=${firstToken}&callbackURL=%2F`,
    });

    // Returning user requests another link — no dateOfBirth needed this time.
    const res = await app.inject({
      method: "POST",
      url: "/auth/pending-signup",
      payload: { email: TEST_EMAIL, dateOfBirth: "invalid-but-unused", country: "Canada" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, isNewUser: false });
  });
});
