import { and, count, eq, gte } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { FAIR_USE_CAP, FREE_SESSION_LIMIT } from "../config.js";

// Deliberately vague about reset timing — the cap spans two rolling windows
// (24h and 30d), so promising "come back tomorrow" would be wrong for
// someone who tripped the 30-day window specifically. See design.md.
export const VELOCITY_CAP_MESSAGE =
  "You've reached your practice limit for now — check back soon.";

export const PAYWALL_MESSAGE = "You've used all your free sessions. Unlock unlimited for $29.";

export async function getFreeSessionsUsed(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.userId, userId),
        eq(schema.sessions.status, "complete"),
        eq(schema.sessions.crisisFlagged, false),
      ),
    );
  return row?.value ?? 0;
}

async function countSessionsSince(userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.userId, userId),
        eq(schema.sessions.crisisFlagged, false),
        gte(schema.sessions.createdAt, since),
      ),
    );
  return row?.value ?? 0;
}

export type EntitlementCheck =
  | { allowed: true }
  | { allowed: false; reason: "paywall"; message: string }
  | { allowed: false; reason: "velocity_cap"; message: string };

/**
 * The single server-side gate every session start must pass through — never
 * trusts a client-supplied entitlement value. Identical for web and Android
 * (see design.md); a decompiled APK can't spoof this because it's enforced
 * here, not from any value the client sends.
 */
export async function checkEntitlement(userId: string): Promise<EntitlementCheck> {
  const [user] = await db.select().from(schema.user).where(eq(schema.user.id, userId));
  if (!user) {
    return { allowed: false, reason: "paywall", message: PAYWALL_MESSAGE };
  }

  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

  // Velocity cap applies regardless of paid/unpaid status — checked first.
  const [count24h, count30d] = await Promise.all([
    countSessionsSince(userId, since24h),
    countSessionsSince(userId, since30d),
  ]);
  if (count24h >= FAIR_USE_CAP.per24h || count30d >= FAIR_USE_CAP.per30d) {
    return { allowed: false, reason: "velocity_cap", message: VELOCITY_CAP_MESSAGE };
  }

  if (user.entitlementStatus === "paid") {
    return { allowed: true };
  }

  const freeUsed = await getFreeSessionsUsed(userId);
  if (freeUsed < FREE_SESSION_LIMIT) {
    return { allowed: true };
  }

  return { allowed: false, reason: "paywall", message: PAYWALL_MESSAGE };
}

export interface EntitlementSnapshot {
  email: string;
  entitlementStatus: "paid" | "unpaid";
  paidAt: Date | null;
  freeSessionsRemaining: number;
}

export async function getEntitlementSnapshot(userId: string): Promise<EntitlementSnapshot | null> {
  const [user] = await db.select().from(schema.user).where(eq(schema.user.id, userId));
  if (!user) return null;

  const freeUsed = await getFreeSessionsUsed(userId);
  return {
    email: user.email,
    entitlementStatus: user.entitlementStatus as "paid" | "unpaid",
    paidAt: user.paidAt,
    freeSessionsRemaining: Math.max(0, FREE_SESSION_LIMIT - freeUsed),
  };
}
