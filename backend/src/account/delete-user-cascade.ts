import { eq, inArray, like } from "drizzle-orm";
import { db, schema } from "../db/client.js";

/**
 * The single owned interception point for account deletion — an explicit,
 * ordered, transactional delete, not `ON DELETE CASCADE` FKs (design.md's
 * decision: a cascade at the DB level can't be intercepted by future
 * application logic, e.g. M7's eventual recomputation-vs-disclosure policy).
 *
 * Tables covered now: the `user` row itself (Better Auth's table, carrying
 * our entitlement fields), practice `sessions`, `session_mining_results`,
 * `stripe_payments`, and Better Auth's own `session`/`account`/`verification`
 * tables — real names confirmed via its Drizzle adapter (tasks.md 2.5), not
 * guessed.
 *
 * `session_mining_results` and `feedback_reports` are both keyed by
 * `sessionId`, not `userId`, so they're deleted from the owning user's
 * session ids, ordered before `sessions` itself (that FK has no
 * `ON DELETE CASCADE` either — see those tables' own schema.ts comments on
 * why).
 *
 * `verification` rows aren't keyed by userId (Better Auth keys them by the
 * token itself, storing the email inside a JSON `value` column) — matched
 * by email instead so no stale magic-link token for this identity survives
 * deletion (see account-management spec's "cannot sign in again" scenario).
 *
 * Tables named in proposal.md/spec Section 13 that don't exist yet as of
 * M1 — transcript_turns, tier1_profiles, anchors, anchor_revisions — belong
 * in this same function, added by whichever module (M2/M6/M9) creates each
 * one. This is the one file to grep to check whether that happened. NOTE
 * (M4, 2026-07-22): transcript_turns still isn't covered here, and its FK
 * has no ON DELETE CASCADE — deleting a user with any completed session may
 * already fail on that pre-existing gap today, independent of this module.
 * Flagged to Robin, not fixed here (out of scope for M4 — see tasks.md 4.3).
 * Still unresolved as of M5 (2026-07-22) — feedback_reports is now covered
 * below, but this gap is untouched; not this module's job to fix either.
 *
 * `anchors`/`anchor_revisions` added by M6 (2026-07-23, tasks.md Group 8).
 * `anchor_revisions` is deleted before `anchors` (FK order), but both run
 * *after* `sessions` is deleted, not before — `sessions.anchor_id` has its
 * own `ON DELETE no action` FK into `anchors.id`, so deleting an anchor
 * still referenced by one of this user's sessions fails immediately (this
 * is enforced per-statement, not deferred to transaction end, even inside
 * this same `tx`) — confirmed by hand against local Postgres before writing
 * this ordering.
 */
export async function deleteUserCascade(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [user] = await tx.select().from(schema.user).where(eq(schema.user.id, userId));
    if (!user) return;

    const ownedSessions = await tx
      .select({ id: schema.sessions.id })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userId));
    const sessionIds = ownedSessions.map((s) => s.id);
    if (sessionIds.length > 0) {
      await tx
        .delete(schema.feedbackReports)
        .where(inArray(schema.feedbackReports.sessionId, sessionIds));
      await tx
        .delete(schema.sessionMiningResults)
        .where(inArray(schema.sessionMiningResults.sessionId, sessionIds));
    }

    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId));

    const ownedAnchors = await tx
      .select({ id: schema.anchors.id })
      .from(schema.anchors)
      .where(eq(schema.anchors.userId, userId));
    const anchorIds = ownedAnchors.map((a) => a.id);
    if (anchorIds.length > 0) {
      await tx.delete(schema.anchorRevisions).where(inArray(schema.anchorRevisions.anchorId, anchorIds));
    }
    await tx.delete(schema.anchors).where(eq(schema.anchors.userId, userId));

    await tx.delete(schema.stripePayments).where(eq(schema.stripePayments.userId, userId));
    await tx.delete(schema.account).where(eq(schema.account.userId, userId));
    await tx.delete(schema.session).where(eq(schema.session.userId, userId));
    await tx
      .delete(schema.verification)
      .where(like(schema.verification.value, `%"email":"${user.email}"%`));
    await tx.delete(schema.user).where(eq(schema.user.id, userId));
  });
}
