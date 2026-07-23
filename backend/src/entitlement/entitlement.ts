import { and, count, eq, gte, lt } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { FAIR_USE_CAP, FREE_SESSION_LIMIT, OFF_TOPIC_SESSION_LIMIT, OFF_TOPIC_THRESHOLD } from "../config.js";

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

/**
 * Inner-joined to `session_mining_results`, so a session with no mining
 * result yet (mining is async, per M4's design) is never counted — see
 * specs/session-entitlement's "no mining result yet" scenario. Excludes
 * crisis-flagged sessions, same exemption `countSessionsSince` already
 * applies — a session flagged during a genuine crisis shouldn't count
 * against the person as fair-use abuse for also being off-topic.
 */
async function countOffTopicSessionsSince(userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(schema.sessions)
    .innerJoin(
      schema.sessionMiningResults,
      eq(schema.sessionMiningResults.sessionId, schema.sessions.id),
    )
    .where(
      and(
        eq(schema.sessions.userId, userId),
        eq(schema.sessions.crisisFlagged, false),
        gte(schema.sessions.createdAt, since),
        lt(schema.sessionMiningResults.topicRelevanceScore, OFF_TOPIC_THRESHOLD),
      ),
    );
  return row?.value ?? 0;
}

export interface AbuseSignal {
  count24h: number;
  count30d: number;
}

/**
 * The Section 17 fair-use signal M4's mining pass feeds — see design.md's
 * Decisions. Read by `checkEntitlement` alongside the existing velocity cap,
 * not exposed to any client.
 */
export async function getAbuseSignal(userId: string): Promise<AbuseSignal> {
  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [count24h, count30d] = await Promise.all([
    countOffTopicSessionsSince(userId, since24h),
    countOffTopicSessionsSince(userId, since30d),
  ]);
  return { count24h, count30d };
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
  const [count24h, count30d, abuseSignal] = await Promise.all([
    countSessionsSince(userId, since24h),
    countSessionsSince(userId, since30d),
    getAbuseSignal(userId),
  ]);
  if (count24h >= FAIR_USE_CAP.per24h || count30d >= FAIR_USE_CAP.per30d) {
    return { allowed: false, reason: "velocity_cap", message: VELOCITY_CAP_MESSAGE };
  }

  // Section 17's off-topic abuse signal — reuses the velocity-cap reason and
  // message so a denial here is indistinguishable from an ordinary velocity
  // cap trip. See design.md's Decisions.
  if (
    abuseSignal.count24h >= OFF_TOPIC_SESSION_LIMIT ||
    abuseSignal.count30d >= OFF_TOPIC_SESSION_LIMIT
  ) {
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
