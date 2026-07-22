import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { deleteUserCascade } from "./delete-user-cascade.js";

const USER_A = { id: "cascade-test-user-a", email: "cascade-a@example.com" };
const USER_B = { id: "cascade-test-user-b", email: "cascade-b@example.com" };

async function seedFullUser(user: { id: string; email: string }) {
  await db.insert(schema.user).values({
    id: user.id,
    name: "",
    email: user.email,
    emailVerified: true,
    entitlementStatus: "paid",
    dateOfBirth: new Date("1990-01-01"),
    country: "Canada",
    paidAt: new Date(),
  });
  await db.insert(schema.sessions).values([
    {
      userId: user.id,
      status: "complete",
      personaAgeRange: "20s-30s",
      personaGenderPresentation: "neutral",
      mode: "text",
    },
    {
      userId: user.id,
      status: "start",
      personaAgeRange: "20s-30s",
      personaGenderPresentation: "neutral",
      mode: "text",
    },
  ]);
  await db.insert(schema.stripePayments).values({
    paymentIntentId: `pi_${user.id}`,
    userId: user.id,
  });
  await db.insert(schema.account).values({
    id: `account_${user.id}`,
    accountId: user.id,
    providerId: "credential",
    userId: user.id,
  });
  await db.insert(schema.session).values({
    id: `session_${user.id}`,
    token: `token_${user.id}`,
    userId: user.id,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
  });
  await db.insert(schema.verification).values({
    id: `verification_${user.id}`,
    identifier: `magic-link-token-${user.id}`,
    value: JSON.stringify({ email: user.email, name: "" }),
    expiresAt: new Date(Date.now() + 1000 * 60 * 5),
  });
}

async function cleanup(user: { id: string; email: string }) {
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
  await db.delete(schema.stripePayments).where(eq(schema.stripePayments.userId, user.id));
  await db.delete(schema.account).where(eq(schema.account.userId, user.id));
  await db.delete(schema.session).where(eq(schema.session.userId, user.id));
  await db.delete(schema.verification).where(eq(schema.verification.id, `verification_${user.id}`));
  await db.delete(schema.user).where(eq(schema.user.id, user.id));
}

describe("deleteUserCascade", () => {
  afterEach(async () => {
    await cleanup(USER_A);
    await cleanup(USER_B);
  });

  it("removes rows from every table for the deleted user, and leaves another user's rows untouched", async () => {
    await seedFullUser(USER_A);
    await seedFullUser(USER_B);

    await deleteUserCascade(USER_A.id);

    // User A — nothing should remain, anywhere.
    expect(await db.select().from(schema.user).where(eq(schema.user.id, USER_A.id))).toHaveLength(0);
    expect(
      await db.select().from(schema.sessions).where(eq(schema.sessions.userId, USER_A.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.stripePayments)
        .where(eq(schema.stripePayments.userId, USER_A.id)),
    ).toHaveLength(0);
    expect(await db.select().from(schema.account).where(eq(schema.account.userId, USER_A.id))).toHaveLength(0);
    expect(await db.select().from(schema.session).where(eq(schema.session.userId, USER_A.id))).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.verification)
        .where(eq(schema.verification.id, `verification_${USER_A.id}`)),
    ).toHaveLength(0);

    // User B — every row should still be there, untouched.
    expect(await db.select().from(schema.user).where(eq(schema.user.id, USER_B.id))).toHaveLength(1);
    expect(
      await db.select().from(schema.sessions).where(eq(schema.sessions.userId, USER_B.id)),
    ).toHaveLength(2);
    expect(
      await db
        .select()
        .from(schema.stripePayments)
        .where(eq(schema.stripePayments.userId, USER_B.id)),
    ).toHaveLength(1);
    expect(await db.select().from(schema.account).where(eq(schema.account.userId, USER_B.id))).toHaveLength(1);
    expect(await db.select().from(schema.session).where(eq(schema.session.userId, USER_B.id))).toHaveLength(1);
    expect(
      await db
        .select()
        .from(schema.verification)
        .where(eq(schema.verification.id, `verification_${USER_B.id}`)),
    ).toHaveLength(1);
  });

  it("is a no-op for a userId that doesn't exist", async () => {
    await expect(deleteUserCascade("does-not-exist")).resolves.toBeUndefined();
  });
});
